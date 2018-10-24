module.exports=function(t){var e={};function n(i){if(e[i])return e[i].exports;var r=e[i]={i:i,l:!1,exports:{}};return t[i].call(r.exports,r,r.exports,n),r.l=!0,r.exports}return n.m=t,n.c=e,n.d=function(t,e,i){n.o(t,e)||Object.defineProperty(t,e,{enumerable:!0,get:i})},n.r=function(t){"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(t,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(t,"__esModule",{value:!0})},n.t=function(t,e){if(1&e&&(t=n(t)),8&e)return t;if(4&e&&"object"==typeof t&&t&&t.__esModule)return t;var i=Object.create(null);if(n.r(i),Object.defineProperty(i,"default",{enumerable:!0,value:t}),2&e&&"string"!=typeof t)for(var r in t)n.d(i,r,function(e){return t[e]}.bind(null,r));return i},n.n=function(t){var e=t&&t.__esModule?function(){return t.default}:function(){return t};return n.d(e,"a",e),e},n.o=function(t,e){return Object.prototype.hasOwnProperty.call(t,e)},n.p="",n(n.s=84)}({0:function(t,e){t.exports=require("tslib")},120:function(t,e){t.exports=require("iframe-resizer")},128:function(t,e,n){"use strict";n.d(e,"a",function(){return r});var i=n(0);function r(t,e,n){return e&&n?o(t,e,n):function(t){var e=function(t){function e(){return null!==t&&t.apply(this,arguments)||this}return i.__extends(e,t),e}(t);return Object.getOwnPropertyNames(t.prototype).forEach(function(n){var i=Object.getOwnPropertyDescriptor(t.prototype,n);i&&"constructor"!==n&&Object.defineProperty(e.prototype,n,o(t.prototype,n,i))}),e}(t)}function o(t,e,n){if("function"!=typeof n.value)return n;var r=n.value;return{get:function(){var t=r.bind(this);return Object.defineProperty(this,e,i.__assign({},n,{value:t})),t},set:function(t){r=t}}}},132:function(t,e,n){"use strict";var i=n(0),r=function(t){function e(e){var n=t.call(this,e||"Invalid arguments have been provided.")||this;return n.type="invalid_argument",n}return i.__extends(e,t),e}(n(7).a);e.a=r},21:function(t,e,n){"use strict";var i;n.d(e,"a",function(){return i}),function(t){t.CheckoutComplete="CHECKOUT_COMPLETE",t.CheckoutError="CHECKOUT_ERROR",t.CheckoutLoaded="CHECKOUT_LOADED",t.FrameError="FRAME_ERROR",t.FrameLoaded="FRAME_LOADED"}(i||(i={}))},54:function(t,e,n){"use strict";function i(t,e){return t.type===e}n.d(e,"a",function(){return i})},69:function(t,e,n){"use strict";var i;n.d(e,"a",function(){return i}),function(t){t.StyleConfigured="STYLE_CONFIGURED"}(i||(i={}))},7:function(t,e,n){"use strict";var i=n(0);var r=function(t){function e(e){var n=this.constructor,i=t.call(this,e||"An unexpected error has occurred.")||this;return i.type="standard",function(t,e){Object.setPrototypeOf?Object.setPrototypeOf(t,e):t.__proto__=e}(i,n.prototype),"function"==typeof Error.captureStackTrace?Error.captureStackTrace(i,n):i.stack=new Error(i.message).stack,i}return i.__extends(e,t),e}(Error);e.a=r},70:function(t,e,n){"use strict";var i=n(0),r=n(128),o=n(54),s=function(){function t(t){this._origin=t,this._isListening=!1,this._listeners={}}return t.prototype.listen=function(){this._isListening||(this._isListening=!0,window.addEventListener("message",this._handleMessage))},t.prototype.stopListen=function(){this._isListening&&(this._isListening=!1,window.removeEventListener("message",this._handleMessage))},t.prototype.addListener=function(t,e){var n=this._listeners[t];n||(this._listeners[t]=n=[]),n.push(e)},t.prototype.removeListener=function(t,e){var n=this._listeners[t];if(n){var i=n.indexOf(e);i>=0&&n.splice(i,1)}},t.prototype.trigger=function(t){var e=this._listeners[t.type];e&&e.forEach(function(e){return e(t)})},t.prototype._handleMessage=function(t){t.origin===this._origin&&Object(o.a)(t.data,t.data.type)&&this.trigger(t.data)},i.__decorate([r.a],t.prototype,"_handleMessage",null),t}();e.a=s},71:function(t,e,n){"use strict";var i=function(){function t(t,e){this._targetOrigin=t,this._targetWindow=e}return t.prototype.post=function(t){if(window!==this._targetWindow){if(!this._targetWindow)throw new Error("Unable to post message becauset target window is not set.");this._targetWindow.postMessage(t,this._targetOrigin)}},t.prototype.setTarget=function(t){this._targetWindow=t},t}();e.a=i},84:function(t,e,n){"use strict";n.r(e);var i=n(21),r=n(69),o=function(){function t(t,e,n,r,o){var s=this;this._iframeCreator=t,this._messageListener=e,this._messagePoster=n,this._loadingIndicator=r,this._options=o,this._isAttached=!1,this._options.onComplete&&this._messageListener.addListener(i.a.CheckoutComplete,this._options.onComplete),this._options.onError&&this._messageListener.addListener(i.a.CheckoutError,this._options.onError),this._options.onLoad&&this._messageListener.addListener(i.a.CheckoutLoaded,this._options.onLoad),this._options.onFrameLoad&&this._messageListener.addListener(i.a.FrameLoaded,this._options.onFrameLoad),this._messageListener.addListener(i.a.FrameLoaded,function(){return s._configureStyles()})}return t.prototype.attach=function(){var t=this;return this._isAttached?Promise.resolve(this):(this._isAttached=!0,this._messageListener.listen(),this._loadingIndicator.show(this._options.containerId),this._iframeCreator.createFrame(this._options.url,this._options.containerId).then(function(e){return t._iframe=e,t._configureStyles(),t._loadingIndicator.hide(),t}).catch(function(e){throw t._isAttached=!1,t._messageListener.trigger({type:i.a.FrameError,payload:e}),t._loadingIndicator.hide(),e}))},t.prototype.detach=function(){this._isAttached&&(this._isAttached=!1,this._messageListener.stopListen(),this._iframe&&this._iframe.parentNode&&(this._iframe.parentNode.removeChild(this._iframe),this._iframe.iFrameResizer.close()))},t.prototype._configureStyles=function(){this._iframe&&this._iframe.contentWindow&&this._options.styles&&(this._messagePoster.setTarget(this._iframe.contentWindow),this._messagePoster.post({type:r.a.StyleConfigured,payload:this._options.styles}))},t}(),s=n(70),a=n(71),c=n(0),u={size:70,color:"#d9d9d9",backgroundColor:"#ffffff"},d="embedded-checkout-loading-indicator-rotation",l=function(){function t(t){this._styles=c.__assign({},u,t&&t.styles),this._defineAnimation(),this._container=this._buildContainer(),this._indicator=this._buildIndicator(),this._container.appendChild(this._indicator)}return t.prototype.show=function(t){if(t){var e=document.getElementById(t);if(!e)throw new Error("Unable to attach the loading indicator because the parent ID is not valid.");e.appendChild(this._container)}this._container.style.visibility="visible",this._container.style.opacity="1"},t.prototype.hide=function(){var t=this,e=function(){t._container.style.visibility="hidden",t._container.removeEventListener("transitionend",e)};this._container.addEventListener("transitionend",e),this._container.style.opacity="0"},t.prototype._buildContainer=function(){var t=document.createElement("div");return t.style.display="block",t.style.bottom="0",t.style.left="0",t.style.height="100%",t.style.width="100%",t.style.position="absolute",t.style.right="0",t.style.top="0",t.style.transition="all 250ms ease-out",t.style.opacity="0",t},t.prototype._buildIndicator=function(){var t=document.createElement("div");return t.style.display="block",t.style.width=this._styles.size+"px",t.style.height=this._styles.size+"px",t.style.borderRadius=this._styles.size+"px",t.style.border="solid 1px",t.style.borderColor=this._styles.backgroundColor+" "+this._styles.backgroundColor+" "+this._styles.color+" "+this._styles.color,t.style.margin="0 auto",t.style.position="absolute",t.style.left="0",t.style.right="0",t.style.top="50%",t.style.transform="translateY(-50%) rotate(0deg)",t.style.transformStyle="preserve-3d",t.style.animation=d+" 500ms infinite cubic-bezier(0.69, 0.31, 0.56, 0.83)",t},t.prototype._defineAnimation=function(){if(!document.getElementById(d)){var t=document.createElement("style");t.id=d,document.head.appendChild(t),t.sheet instanceof CSSStyleSheet&&t.sheet.insertRule("\n                @keyframes "+d+" {\n                    0% { transform: translateY(-50%) rotate(0deg); }\n                    100% { transform: translateY(-50%) rotate(360deg); }\n                }\n            ")}},t}(),h=n(132);function f(t){if(!/^(https?:)?\/\//.test(t))throw new h.a("The provided URL must be absolute.");var e=document.createElement("a");return e.href=t,e.protocol+"//"+e.hostname+(e.port?":"+e.port:"")}var p=n(120),_=function(t){function e(e){var n=t.call(this,e||"Unable to embed the checkout form.")||this;return n.type="not_embeddable",n}return c.__extends(e,t),e}(n(7).a),y=n(54),m=function(){function t(t){this._options=t}return t.prototype.createFrame=function(t,e){var n=document.getElementById(e),i=(this._options||{}).timeout,r=void 0===i?6e4:i;if(!n)throw new _("Unable to embed the iframe because the container element could not be found.");var o=document.createElement("iframe");return o.src=t,o.style.border="none",o.style.display="none",o.style.width="100%",n.appendChild(o),this._toResizableFrame(o,r).catch(function(t){throw n.removeChild(o),t})},t.prototype._toResizableFrame=function(t,e){return new Promise(function(n,r){var o=window.setTimeout(function(){r(new _("Unable to embed the iframe because the content could not be loaded."))},e),s=function(e){if(e.origin===f(t.src)&&(Object(y.a)(e.data,i.a.FrameError)&&(a(),r(new _(e.data.payload.message))),Object(y.a)(e.data,i.a.FrameLoaded))){t.style.display="";var o=Object(p.iframeResizer)({scrolling:!1,sizeWidth:!1,heightCalculationMethod:"lowestElement"},t);a(),n(o[o.length-1])}},a=function(){window.removeEventListener("message",s),window.clearTimeout(o)};window.addEventListener("message",s)})},t}();function g(t){var e=f(t.url);return new o(new m,new s.a(e),new a.a(e),new l({styles:t.styles&&t.styles.loadingIndicator}),t).attach()}n.d(e,"embedCheckout",function(){return g})}});
//# sourceMappingURL=embedded-checkout.js.map