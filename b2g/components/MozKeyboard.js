/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/ObjectWrapper.jsm");

XPCOMUtils.defineLazyServiceGetter(this, "cpmm",
  "@mozilla.org/childprocessmessagemanager;1", "nsIMessageSender");

XPCOMUtils.defineLazyServiceGetter(this, "tm",
  "@mozilla.org/thread-manager;1", "nsIThreadManager");

// -----------------------------------------------------------------------
// MozKeyboard
// -----------------------------------------------------------------------

function MozKeyboard() { }

MozKeyboard.prototype = {
  classID: Components.ID("{397a7fdf-2254-47be-b74e-76625a1a66d5}"),

  QueryInterface: XPCOMUtils.generateQI([
    Ci.nsIB2GKeyboard, Ci.nsIDOMGlobalPropertyInitializer, Ci.nsIObserver
  ]),

  classInfo: XPCOMUtils.generateCI({
    "classID": Components.ID("{397a7fdf-2254-47be-b74e-76625a1a66d5}"),
    "contractID": "@mozilla.org/b2g-keyboard;1",
    "interfaces": [Ci.nsIB2GKeyboard],
    "flags": Ci.nsIClassInfo.DOM_OBJECT,
    "classDescription": "B2G Virtual Keyboard"
  }),

  init: function mozKeyboardInit(win) {
    let principal = win.document.nodePrincipal;
    let perm = Services.perms
               .testExactPermissionFromPrincipal(principal, "keyboard");
    if (perm != Ci.nsIPermissionManager.ALLOW_ACTION) {
      dump("No permission to use the keyboard API for " +
           principal.origin + "\n");
      return null;
    }

    Services.obs.addObserver(this, "inner-window-destroyed", false);
    cpmm.addMessageListener('Keyboard:FocusChange', this);
    cpmm.addMessageListener('Keyboard:SelectionChange', this);
    cpmm.addMessageListener('Keyboard:TextChange', this);

    this._window = win;
    this._utils = win.QueryInterface(Ci.nsIInterfaceRequestor)
                     .getInterface(Ci.nsIDOMWindowUtils);
    this.innerWindowID = this._utils.currentInnerWindowID;
    this._focusHandler = null;
    this._selectionHandler = null;
    this._selectionStart = -1;
    this._selectionEnd = -1;
    this._text = "";
    this._canAdvanceFocus = false;
    this._canRewindFocus = false;
    this._inputType = "";
    this._inputMode = "";
    this._returnKeyType = "";
    this._returnKeyLabel = "";
  },

  uninit: function mozKeyboardUninit() {
    Services.obs.removeObserver(this, "inner-window-destroyed");
    cpmm.removeMessageListener('Keyboard:FocusChange', this);
    cpmm.removeMessageListener('Keyboard:SelectionChange', this);
    cpmm.removeMessageListener('Keyboard:TextChange', this);

    this._window = null;
    this._utils = null;
    this._focusHandler = null;
    this._selectionHandler = null;
  },

  sendKey: function mozKeyboardSendKey(keyCode, charCode) {
    charCode = (charCode == undefined) ? keyCode : charCode;

    let mainThread = tm.mainThread;
    let utils = this._utils;

    function send(type) {
      mainThread.dispatch(function() {
	utils.sendKeyEvent(type, keyCode, charCode, null);
      }, mainThread.DISPATCH_NORMAL);
    }

    send("keydown");
    send("keypress");
    send("keyup");
  },

  setSelectedOption: function mozKeyboardSetSelectedOption(index) {
    cpmm.sendAsyncMessage('Keyboard:SetSelectedOption', {
      'index': index
    });
  },

  setValue: function mozKeyboardSetValue(value) {
    cpmm.sendAsyncMessage('Keyboard:SetValue', {
      'value': value
    });
  },

  set text(val) {
    this.setValue(val);
  },
  
  get text() {
    return this._text;
  },

  setSelectedOptions: function mozKeyboardSetSelectedOptions(indexes) {
    cpmm.sendAsyncMessage('Keyboard:SetSelectedOptions', {
      'indexes': indexes
    });
  },

  set onselectionchange(val) {
    this._selectionHandler = val;
  },

  get onselectionchange() {
    return this._selectionHandler;
  },

  get selectionStart() {
    return this._selectionStart;
  },

  get selectionEnd() {
    return this._selectionEnd;
  },

  setSelectionRange: function mozKeyboardSetSelectionRange(start, end) {
    cpmm.sendAsyncMessage('Keyboard:SetSelectionRange', {
      'selectionStart': start,
      'selectionEnd': end
    });
  },

  removeFocus: function mozKeyboardRemoveFocus() {
    cpmm.sendAsyncMessage('Keyboard:RemoveFocus', {});
  },

  set onfocuschange(val) {
    this._focusHandler = val;
  },

  get onfocuschange() {
    return this._focusHandler;
  },

  deleteSurroundingText:
      function mozKeyboardDeleteSurroundingText(beforeLength, afterLength) {
    cpmm.sendAsyncMessage('Keyboard:DeleteSurroundingText', {
      'beforeLength': beforeLength,
      'afterLength': afterLength
    });
  },

  commitText: function mozCommitText(text) {
    cpmm.sendAsyncMessage('Keyboard:CommitText', {
      'text': text
    });
  },

  setComposingText: function mozKeyboardSetComposingText(text) {
    cpmm.sendAsyncMessage('Keyboard:SetComposingText', {
      'text': text
    });
  },

  advanceFocus: function mozKeyboardAdvanceFocus() {
    cpmm.sendAsyncMessage('Keyboard:MoveFocus', {
      'direction': 'forward'
    });
  },

  rewindFocus: function mozKeyboardRewindFocus() {
    cpmm.sendAsyncMessage('Keyboard:MoveFocus', {
      'direction': 'backward'
    });
  },

   get canAdvanceFocus() {
     return this._canAdvanceFocus;
   },

   get canRewindFocus() {
     return this._canRewindFocus;
   },

  get inputType() {
    return this._inputType;
  },

  get inputMode() {
    return this._inputMode;
  },

  get returnKeyType() {
    return this._returnKeyType;
  },

  get returnKeyLabel() {
    return this._returnKeyLabel;
  },

  receiveMessage: function mozKeyboardReceiveMessage(msg) {
    if (msg.name == "Keyboard:FocusChange") {
       let msgJson = msg.json;
       if (msgJson.type != "blur") {
         this._selectionStart = msgJson.selectionStart;
         this._selectionEnd = msgJson.selectionEnd;
         this._text = msgJson.value;
         this._canAdvanceFocus = msgJson.canAdvanceFocus;
         this._canRewindFocus = msgJson.canRewindFocus;
         this._inputType = msgJson.type;// XXX These two types are not identical.
         this._inputMode = msgJson.inputmode;
         this._returnKeyType = msgJson.returnkeytype;
         this._returnKeyLabel = msgJson.returnkeylabel;
       } else {
         this._selectionStart = 0;
         this._selectionEnd = 0;
         this._text = "";
         this._canAdvanceFocus = false;
         this._canRewindFocus = false;
         this._inputType = "";
         this._inputMode = "";
         this._returnKeyType = "";
         this._returnKeyLabel = "";
       }

      let handler = this._focusHandler;
      if (!handler || !(handler instanceof Ci.nsIDOMEventListener))
        return;

      let detail = {
        "detail": msgJson
      };

      let evt = new this._window.CustomEvent("focuschanged",
          ObjectWrapper.wrap(detail, this._window));
      handler.handleEvent(evt);
    } else if (msg.name == "Keyboard:SelectionChange") {
      let msgJson = msg.json;

      this._selectionStart = msgJson.selectionStart;
      this._selectionEnd = msgJson.selectionEnd;

      let handler = this._selectionHandler;
      if (!handler || !(handler instanceof Ci.nsIDOMEventListener))
        return;

      let evt = new this._window.CustomEvent("selectionchange",
          ObjectWrapper.wrap({}, this._window));
      handler.handleEvent(evt);
    } else if (msg.name == "Keyboard:TextChange") {
      this._text = msg.json.text;
    }
  },

  observe: function mozKeyboardObserve(subject, topic, data) {
    let wId = subject.QueryInterface(Ci.nsISupportsPRUint64).data;
    if (wId == this.innerWindowID)
      this.uninit();
  }
};

this.NSGetFactory = XPCOMUtils.generateNSGetFactory([MozKeyboard]);
