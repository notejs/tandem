"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = y[op[0] & 2 ? "return" : op[0] ? "throw" : "next"]) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [0, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var io = require("socket.io-client");
var redux_saga_1 = require("redux-saga");
var state_1 = require("../state");
var PERSIST_DELAY_TIMEOUT = 1000;
var aerial_common2_1 = require("aerial-common2");
var effects_1 = require("redux-saga/effects");
var actions_1 = require("../actions");
var SAVE_KEY = "app-state";
function apiSaga() {
    var apiHost;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, effects_1.select()];
            case 1:
                apiHost = (_a.sent()).apiHost;
                return [4 /*yield*/, effects_1.fork(getComponents)];
            case 2:
                _a.sent();
                return [4 /*yield*/, effects_1.fork(syncWorkspaceState)];
            case 3:
                _a.sent();
                return [4 /*yield*/, effects_1.fork(aerial_common2_1.createSocketIOSaga(io(apiHost)))];
            case 4:
                _a.sent();
                return [4 /*yield*/, effects_1.fork(handlePingPong)];
            case 5:
                _a.sent();
                return [2 /*return*/];
        }
    });
}
exports.apiSaga = apiSaga;
function getComponents() {
    var apiHost, response, json;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!true) return [3 /*break*/, 6];
                return [4 /*yield*/, effects_1.select()];
            case 1:
                apiHost = (_a.sent()).apiHost;
                return [4 /*yield*/, effects_1.call(fetch, apiHost + "/components")];
            case 2:
                response = _a.sent();
                return [4 /*yield*/, effects_1.call(response.json.bind(response))];
            case 3:
                json = _a.sent();
                return [4 /*yield*/, effects_1.put(actions_1.apiComponentsLoaded(json))];
            case 4:
                _a.sent();
                // just refresh whenever a file has changed
                return [4 /*yield*/, effects_1.take([actions_1.FILE_CONTENT_CHANGED, actions_1.FILE_REMOVED, actions_1.COMPONENT_SCREENSHOT_SAVED])];
            case 5:
                // just refresh whenever a file has changed
                _a.sent();
                return [3 /*break*/, 0];
            case 6: return [2 /*return*/];
        }
    });
}
function syncWorkspaceState() {
    var state, apiHost, pojoState, e_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, effects_1.fork(function () {
                    var prevState, state_2, pojoState, apiHost_1;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, effects_1.take(actions_1.TRIED_LOADING_APP_STATE)];
                            case 1:
                                _a.sent();
                                _a.label = 2;
                            case 2:
                                if (!true) return [3 /*break*/, 7];
                                return [4 /*yield*/, effects_1.take()];
                            case 3:
                                _a.sent();
                                return [4 /*yield*/, effects_1.call(redux_saga_1.delay, PERSIST_DELAY_TIMEOUT)];
                            case 4:
                                _a.sent();
                                return [4 /*yield*/, effects_1.select()];
                            case 5:
                                state_2 = _a.sent();
                                if (prevState === state_2) {
                                    return [3 /*break*/, 2];
                                }
                                prevState = state_2;
                                pojoState = state_1.serializeApplicationState(state_2);
                                apiHost_1 = state_2.apiHost;
                                return [4 /*yield*/, effects_1.call(fetch, apiHost_1 + "/storage/" + state_2.storageNamespace + SAVE_KEY, {
                                        method: "POST",
                                        headers: {
                                            'Accept': 'application/json',
                                            'Content-Type': 'application/json'
                                        },
                                        body: JSON.stringify(pojoState)
                                    })];
                            case 6:
                                _a.sent();
                                return [3 /*break*/, 2];
                            case 7: return [2 /*return*/];
                        }
                    });
                })];
            case 1:
                _a.sent();
                return [4 /*yield*/, effects_1.select()];
            case 2:
                state = _a.sent();
                return [4 /*yield*/, effects_1.select()];
            case 3:
                apiHost = (_a.sent()).apiHost;
                _a.label = 4;
            case 4:
                _a.trys.push([4, 8, , 9]);
                return [4 /*yield*/, effects_1.call(function () {
                        return __awaiter(this, void 0, void 0, function () {
                            var response;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, fetch(apiHost + "/storage/" + state.storageNamespace + SAVE_KEY)];
                                    case 1:
                                        response = _a.sent();
                                        return [4 /*yield*/, response.json()];
                                    case 2: return [2 /*return*/, _a.sent()];
                                }
                            });
                        });
                    })];
            case 5:
                pojoState = _a.sent();
                if (!pojoState) return [3 /*break*/, 7];
                return [4 /*yield*/, effects_1.put(actions_1.loadedSavedState(pojoState))];
            case 6:
                _a.sent();
                _a.label = 7;
            case 7: return [3 /*break*/, 9];
            case 8:
                e_1 = _a.sent();
                console.warn(e_1);
                return [3 /*break*/, 9];
            case 9: return [4 /*yield*/, effects_1.put(actions_1.triedLoadedSavedState())];
            case 10:
                _a.sent();
                return [2 /*return*/];
        }
    });
}
function handlePingPong() {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!1) return [3 /*break*/, 3];
                return [4 /*yield*/, effects_1.take("$$TANDEM_FE_PING")];
            case 1:
                _a.sent();
                return [4 /*yield*/, effects_1.put({ type: "$$TANDEM_FE_PONG", $public: true })];
            case 2:
                _a.sent();
                return [3 /*break*/, 0];
            case 3: return [2 /*return*/];
        }
    });
}
//# sourceMappingURL=api.js.map