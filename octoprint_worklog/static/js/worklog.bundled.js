/*
 * View model for OctoPrint-WorkLog
 *
 * Author: Alexander Shvetsov <shv-box@mail.com> based on FilamentManager by Sven Lohrmann <malnvenshorn@gmail.com>
 *
 * License: AGPLv3
 */

var WorkLog = function WorkLog() {
    this.core.common.call(this);
    this.core.client.call(this);
    return this.core.bridge.call(this);
};

WorkLog.prototype = {
    constructor: WorkLog,
    core: {},
    viewModels: {}
};
var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Utils = function () {
    function Utils() {
        _classCallCheck(this, Utils);
    }

    _createClass(Utils, null, [{
        key: 'validInt',
        // eslint-disable-line no-unused-vars
        value: function validInt(value, def) {
            var v = Number.parseInt(value, 10);
            return Number.isNaN(v) ? def : v;
        }
    }, {
        key: 'validFloat',
        value: function validFloat(value, def) {
            var v = Number.parseFloat(value);
            return Number.isNaN(v) ? def : v;
        }
    }, {
        key: 'runRequestChain',
        value: function runRequestChain(requests) {
            var index = 0;

            var next = function callNextRequest() {
                if (index < requests.length) {
                    // Do the next, increment the call index
                    requests[index]().done(function () {
                        index += 1;
                        next();
                    });
                }
            };

            next(); // Start chain
        }
    }, {
        key: 'extractToolIDFromName',
        value: function extractToolIDFromName(name) {
            var result = /(\d+)/.exec(name);
            return result === null ? 0 : result[1];
        }
    }, {
        key: 'sortStrColAsc',
        value: function sortStrColAsc(column, a, b) {
            if (a[column].toLocaleLowerCase() < b[column].toLocaleLowerCase()) return -1;
            if (a[column].toLocaleLowerCase() > b[column].toLocaleLowerCase()) return 1;
            return 0;
        }
    }, {
        key: 'sortStrColDesc',
        value: function sortStrColDesc(column, a, b) {
            if (a[column].toLocaleLowerCase() < b[column].toLocaleLowerCase()) return 1;
            if (a[column].toLocaleLowerCase() > b[column].toLocaleLowerCase()) return -1;
            return 0;
        }
    }, {
        key: 'sortIntColAsc',
        value: function sortIntColAsc(column, a, b) {
            var ta = parseInt(a[column]);
            var tb = parseInt(b[column]);
            if (ta < tb) return 1;
            if (ta > tb) return -1;
            return 0;
        }
    }, {
        key: 'sortIntColDesc',
        value: function sortIntColDesc(column, a, b) {
            var ta = parseInt(a[column]);
            var tb = parseInt(b[column]);
            if (ta < tb) return -1;
            if (ta > tb) return 1;
            return 0;
        }
    }, {
        key: 'printJSON',
        value: function printJSON(data) {
            var indent = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';

            for (var key in data) {
                var val = data[key];
                if ((typeof val === 'undefined' ? 'undefined' : _typeof(val)) === 'object') {
                    console.log(indent + 'key: ' + key + ', value: ');
                    Utils.printJSON(val, indent + '  ');
                } else {
                    console.log(indent + 'key: ' + key + ', value: ' + val);
                }
            }
        }
    }]);

    return Utils;
}();
/* global WorkLog  _ */

WorkLog.prototype.core.bridge = function pluginBridge() {
    var self = this;

    self.core.bridge = {
        allViewModels: {},

        REQUIRED_VIEWMODELS: ['settingsViewModel', 'printerStateViewModel', 'loginStateViewModel', 'filesViewModel', 'connectionViewModel'],

        BINDINGS: ['#tab_plugin_worklog', '#settings_plugin_worklog', '#dialog_job_edit_worklog'],

        viewModel: function WorkLogViewModel(viewModels) {
            self.core.bridge.allViewModels = _.object(self.core.bridge.REQUIRED_VIEWMODELS, viewModels);
            self.core.callbacks.call(self);

            Object.values(self.viewModels).forEach(function (viewModel) {
                return viewModel.call(self);
            });

            return self;
        }
    };

    return self.core.bridge;
};
/* global WorkLog Utils _ */

WorkLog.prototype.core.callbacks = function octoprintCallbacks() {
    var self = this;

    // self.onStartup = function onStartupCallback() {
    //     self.viewModels.warning.replaceFilamentView();
    // };

    self.onBeforeBinding = function onBeforeBindingCallback() {
        self.viewModels.config.loadData();
        // self.viewModels.selections.setArraySize();
        // self.viewModels.selections.setSubscriptions();
        // self.viewModels.warning.setSubscriptions();
    };

    self.onStartupComplete = function onStartupCompleteCallback() {
        var requests = [self.viewModels.userFilter.requestUsers, self.viewModels.printerFilter.requestPrinters, self.viewModels.jobs.requestFiles, self.viewModels.jobs.requestJobs];

        // We chain them because, e.g. selections depends on spools
        Utils.runRequestChain(requests);
    };

    self.onSettingsBeforeSave = function onSettingsBeforeSaveCallback() {
        self.viewModels.config.saveData();
    };

    self.onDataUpdaterPluginMessage = function onDataUpdaterPluginMessageCallback(plugin, message) {
        if (plugin !== 'worklog') return;

        var type = message.type,
            data = message.data;
        // TODO needs improvement

        if (type === 'data_changed') {
            if (data.table === 'jobs') {
                self.viewModels.userFilter.requestUsers();
                self.viewModels.printerFilter.requestPrinters();
                self.viewModels.jobs.requestJobs();
            } else if (data.table === 'users') {
                self.viewModels.userFilter.requestUsers();
            } else if (data.table === 'printers') {
                self.viewModels.printerFilter.requestPrinters();
            }
        }
    };

    self.onEventFileRemoved = function onFileRemoved(data) {
        self.onFilesUpdated(data);
    };

    self.onEventFileAdded = function onFileAdded(data) {
        self.onFilesUpdated(data);
    };

    self.onEventFolderRemoved = function onFolderRemoved(data) {
        self.onFilesUpdated(data);
    };

    self.onFilesUpdated = function onFilesUpdatedHelper(data) {
        var type = data.type;

        if (!(type === undefined || _.contains(type, 'machinecode'))) return;

        var requests = [self.viewModels.jobs.requestFiles, self.viewModels.jobs.requestJobs];
        Utils.runRequestChain(requests);
    };
};
/* global WorkLog OctoPrint */

WorkLog.prototype.core.client = function apiClient() {
    var self = this.core.client;

    var pluginUrl = 'plugin/worklog';

    var jobUrl = function apiJobNamespace(id) {
        var url = pluginUrl + '/jobs';
        return id === undefined ? url : url + '/' + id;
    };

    var userUrl = function apiUserNamespace(name) {
        var url = pluginUrl + '/users';
        return name === undefined ? url : url + '/' + name;
    };

    var printerUrl = function apiPrinterNamespace(name) {
        var url = pluginUrl + '/printers';
        return name === undefined ? url : url + '/' + name;
    };

    //~ const totalsUrl = function apiTotalsNamespace() {
    //~ return `${pluginUrl}/totals`;
    //~ };

    self.job = {
        list: function list() {
            var force = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;
            var opts = arguments[1];

            var query = force ? { force: force } : {};
            return OctoPrint.getWithQuery(jobUrl(), query, opts);
        },
        get: function get(id, opts) {
            return OctoPrint.get(jobUrl(id), opts);
        },


        //~ add(job, opts) {
        //~ const data = { job };
        //~ return OctoPrint.postJson(jobUrl(), data, opts);
        //~ },

        update: function update(id, job, opts) {
            var data = { job: job };
            return OctoPrint.patchJson(jobUrl(id), data, opts);
        },
        delete: function _delete(id, opts) {
            return OctoPrint.delete(jobUrl(id), opts);
        }
    };

    self.user = {
        list: function list() {
            var force = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;
            var opts = arguments[1];

            var query = force ? { force: force } : {};
            return OctoPrint.getWithQuery(userUrl(), query, opts);
        },
        get: function get(id, opts) {
            return OctoPrint.get(userUrl(id), opts);
        }
    };

    self.printer = {
        list: function list() {
            var force = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;
            var opts = arguments[1];

            var query = force ? { force: force } : {};
            return OctoPrint.getWithQuery(printerUrl(), query, opts);
        },
        get: function get(id, opts) {
            return OctoPrint.get(printerUrl(id), opts);
        }
    };

    //~ self.totals = {
    //~ get(force = false, filters = undefined, opts) {
    //~ const query = force ? { force } : {};
    //~ if (filters) {
    //~ const { user, printer, status, begin, end } = filters; // eslint-disable-line object-curly-newline
    //~ if (user) { query.user = user; }
    //~ if (printer) { query.printer = printer; }
    //~ if (status !== undefined) { query.status = status; }
    //~ if (begin > 0) { query.begin = begin; }
    //~ if (end > 0) { query.end = end; }
    //~ }
    //~ return OctoPrint.getWithQuery(totalsUrl(), query, opts);
    //~ },
    //~ };

    self.database = {
        test: function test(config, opts) {
            var url = pluginUrl + '/database/test';
            var data = { config: config };
            return OctoPrint.postJson(url, data, opts);
        }
    };
};
/* global WorkLog Object */

WorkLog.prototype.core.common = function pluginCommonValues() {
    var self = this.core.common;

    self.jobStatus = {
        STATUS_FAIL_SYS: -2,
        STATUS_FAIL_USER: -1,
        STATUS_UNDEFINED: 0,
        STATUS_SUCCESS: 1
    };

    Object.freeze(self.jobStatus);
};
/* global WorkLog ko $ */

WorkLog.prototype.viewModels.config = function configurationViewModel() {
    var self = this.viewModels.config;
    var api = this.core.client;
    var settingsViewModel = this.core.bridge.allViewModels.settingsViewModel;


    self.config = ko.mapping.fromJS({});

    self.saveData = function () {
        settingsViewModel.settings.plugins.worklog = ko.mapping.toJS(self.config);
    };

    self.loadData = function () {
        var pluginSettings = settingsViewModel.settings.plugins.worklog;
        ko.mapping.fromJS(ko.toJS(pluginSettings), self.config);
        // console.log(self.config.database.useExternal());
        // console.log(self.config.database.uri());
        // console.log(self.config.database.user());
    };

    self.connectionTest = function (viewModel, event) {
        // console.log('connectionTest');
        var target = $(event.target);
        target.removeClass('btn-success btn-danger');
        target.prepend('<i class="fa fa-spinner fa-spin"></i> ');
        target.prop('disabled', true);

        var data = ko.mapping.toJS(self.config.database);

        api.database.test(data).done(function () {
            target.addClass('btn-success');
        }).fail(function () {
            target.addClass('btn-danger');
        }).always(function () {
            $('i.fa-spinner', target).remove();
            target.prop('disabled', false);
        });
    };
};
/* global WorkLog ko gettext */

WorkLog.prototype.viewModels.periodFilter = function periodFilterViewModel() {
    var self = this.viewModels.periodFilter;

    self.allItems = ko.observableArray([{ name: gettext('Today'), value: 0 }, { name: gettext('Yesterday'), value: 1 }, { name: gettext('Week'), value: 2 }, { name: gettext('Last Week'), value: 3 }, { name: gettext('Month'), value: 4 }, { name: gettext('Last Month'), value: 5 }, { name: gettext('Year'), value: 6 }, { name: gettext('Last Year'), value: 7 }]);
    self.value = ko.observable();
    self.selected = ko.observable();

    self.begin = undefined;
    self.end = undefined;

    self.changed = function () {
        var now = new Date();
        var y = now.getFullYear();
        var m = now.getMonth();
        var d = now.getDate();

        switch (self.selected()) {
            case 0:
                self.begin = new Date(y, m, d).getTime() / 1000;
                self.end = new Date(y, m, d + 1).getTime() / 1000;
                break;
            case 1:
                self.begin = new Date(y, m, d - 1).getTime() / 1000;
                self.end = new Date(y, m, d).getTime() / 1000;
                break;
            case 2:
                {
                    var day = now.getDay();
                    var dw = d - day - (day === 0 ? 6 : -1);
                    self.begin = new Date(y, m, dw).getTime() / 1000;
                    self.end = new Date(y, m, dw + 7).getTime() / 1000;
                }
                break;
            case 3:
                {
                    var _day = now.getDay();
                    var _dw = d - _day - (_day === 0 ? 6 : -1);
                    self.begin = new Date(y, m, _dw - 7).getTime() / 1000;
                    self.end = new Date(y, m, _dw).getTime() / 1000;
                }
                break;
            case 4:
                self.begin = new Date(y, m, 1).getTime() / 1000;
                self.end = new Date(y, m + 1, 1).getTime() / 1000;
                break;
            case 5:
                self.begin = new Date(y, m - 1, 1).getTime() / 1000;
                self.end = new Date(y, m, 1).getTime() / 1000;
                break;
            case 6:
                self.begin = new Date(y, 0).getTime() / 1000;
                self.end = new Date(y + 1, 0, 1).getTime() / 1000;
                break;
            case 7:
                self.begin = new Date(y - 1, 0, 1).getTime() / 1000;
                self.end = new Date(y, 0, 1).getTime() / 1000;
                break;
            default:
                self.begin = -1;
                self.end = -1;
        }

        self.value(self.selected());

        // console.log('periodFilterChanged: ' + formatDate(self.begin) + ' - ' + formatDate(self.end));
    };

    self.test = function (value) {
        // eslint-disable-line arrow-body-style
        return self.value() === undefined || self.begin === undefined || value >= self.begin && value < self.end;
    };
};
function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

/* global WorkLog ko _ gettext */

WorkLog.prototype.viewModels.printerFilter = function printerFilterViewModel() {
    var self = this.viewModels.printerFilter;
    var api = this.core.client;

    var connLib = this.core.bridge.allViewModels.connectionViewModel;

    var THIS = gettext('This');

    self.activePrinter = undefined;
    connLib.selectedPrinter.subscribe(function () {
        var profile = _.findWhere(connLib.printerOptions(), { id: connLib.selectedPrinter() });
        self.activePrinter = profile ? profile.name : undefined;
    });

    self.allItems = ko.observableArray([]);
    self.selected = ko.observable(undefined);
    self.value = ko.observable(undefined);

    self.requestInProgress = ko.observable(false);

    self.changed = function () {
        if (self.selected() === THIS) {
            self.selected(self.activePrinter);
        }
        self.value(self.selected());
    };

    self.test = function (value) {
        return self.value() === undefined || value === self.value();
    };

    self.processPrinters = function (data, opts) {
        // console.log(opts);
        if (opts === 'notmodified') return;

        var firstRun = self.allItems().length === 0;
        var printerInList = undefined;
        var printers = data.printers;


        if (printers === undefined) {
            printers = [];
        } else if (self.activePrinter) {
            printerInList = _.find(printers, function (entry) {
                return entry.name === self.activePrinter;
            });
            if (printerInList) {
                printers = [{ name: THIS }].concat(_toConsumableArray(printers));
            }
        }

        self.allItems(printers);

        if (firstRun) {
            self.selected(printerInList ? self.activePrinter : undefined);
            self.changed();
        }
    };

    self.requestPrinters = function (force) {
        self.requestInProgress(true);
        return api.printer.list(force, { ifModified: true }).done(function (response, opts) {
            self.processPrinters(response, opts);
        }).always(function () {
            self.requestInProgress(false);
        });
    };
};
/* global WorkLog ko gettext */

WorkLog.prototype.viewModels.statusFilter = function statusFilterViewModel() {
    var self = this.viewModels.statusFilter;
    var db = this.core.common.jobStatus;

    self.allItems = ko.observableArray([{ name: gettext('Printed'), value: 0 }, { name: gettext('Failed'), value: 1 }, { name: gettext('Good'), value: 2 }, { name: gettext('In Print'), value: 3 }]);
    self.selected = ko.observable();
    self.value = ko.observable();

    self.changed = function () {
        self.value(self.selected());
    };

    self.test = function (value) {
        switch (self.selected()) {// eslint-disable-line default-case
            case undefined:
                // All
                return true;
            case 0:
                // Printed
                return value === db.STATUS_SUCCESS;
            case 1:
                // Failed
                return value < db.STATUS_UNDEFINED;
            case 2:
                // Good
                return value >= db.STATUS_UNDEFINED;
            case 3:
                // In Print
                return value === db.STATUS_UNDEFINED;
        }
        return false;
    };
};
function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

/* global WorkLog ko _ gettext */

WorkLog.prototype.viewModels.userFilter = function userFilterViewModel() {
    var self = this.viewModels.userFilter;
    var api = this.core.client;

    var loginLib = this.core.bridge.allViewModels.loginStateViewModel;

    var THIS = gettext('This');

    self.activeUser = undefined;
    loginLib.currentUser.subscribe(function () {
        var user = loginLib.currentUser();
        self.activeUser = user ? user.name : undefined;
    });

    self.allItems = ko.observableArray([]);
    self.selected = ko.observable(undefined);
    self.value = ko.observable(undefined);

    self.requestInProgress = ko.observable(false);

    self.changed = function () {
        if (self.selected() === THIS) {
            self.selected(self.activeUser);
        }
        self.value(self.selected());
    };

    self.test = function (value) {
        return self.selected() === undefined || value === self.value();
    };

    self.processUsers = function (data, opts) {
        // console.log(opts);
        if (opts === 'notmodified') return;

        var firstRun = self.allItems().length === 0;
        //~ let userInList = undefined;
        var userInList = false;
        var users = data.users;


        if (users === undefined) {
            users = [];
        } else if (self.activeUser) {
            //~ userInList = _.find(users, entry => entry.name === self.activeUser);
            userInList = _.findWhere(users, { name: self.activeUser }) !== undefined;
            if (userInList) {
                users = [{ name: THIS }].concat(_toConsumableArray(users));
            }
        }

        self.allItems(users);

        if (firstRun) {
            self.selected(userInList ? self.activeUser : undefined);
            self.changed();
        }
    };

    self.requestUsers = function (force) {
        self.requestInProgress(true);
        return api.user.list(force, { ifModified: true }).done(function (response, opts) {
            self.processUsers(response, opts);
        }).always(function () {
            self.requestInProgress(false);
        });
    };
};
/* global WorkLog ko $ PNotify gettext */

WorkLog.prototype.viewModels.import = function importDataViewModel() {
    var self = this.viewModels.import;

    var importButton = $('#settings_plugin_worklog_import_button');
    var importElement = $('#settings_plugin_worklog_import');

    self.importFilename = ko.observable();
    self.importInProgress = ko.observable(false);

    self.afterImportCallbacks = [];

    self.invalidArchive = ko.pureComputed(function () {
        var name = self.importFilename();
        return name !== undefined && !name.toLocaleLowerCase().endsWith('.zip');
    });

    self.enableImport = ko.pureComputed(function () {
        var name = self.importFilename();
        return name !== undefined && name.trim() !== '' && !self.invalidArchive();
    });

    importElement.fileupload({
        dataType: 'json',
        maxNumberOfFiles: 1,
        autoUpload: false,
        add: function add(e, data) {
            if (data.files.length === 0) return;

            self.importFilename(data.files[0].name);

            importButton.unbind('click');
            importButton.bind('click', function (event) {
                self.importInProgress(true);
                event.preventDefault();
                data.submit();
            });
        },
        done: function done() {
            self.afterImportCallbacks.forEach(function (callback) {
                callback();
            });
        },
        fail: function fail() {
            new PNotify({ // eslint-disable-line no-new
                title: gettext('Data import failed'),
                text: gettext('Something went wrong, please consult the logs.'),
                type: 'error',
                hide: false
            });
        },
        always: function always() {
            importButton.unbind('click');
            self.importFilename(undefined);
            self.importInProgress(false);
        }
    });
};
/* global WorkLog ItemListHelper ko gettext Utils OctoPrint PNotify formatDuration _ */

WorkLog.prototype.viewModels.jobs = function jobsViewModel() {
    var self = this.viewModels.jobs;
    var api = this.core.client;
    var db = this.core.common.jobStatus;

    var filesLib = this.core.bridge.allViewModels.filesViewModel;
    var connLib = this.core.bridge.allViewModels.connectionViewModel;
    var loginLib = this.core.bridge.allViewModels.loginStateViewModel;

    var fltUser = this.viewModels.userFilter;
    var fltPrinter = this.viewModels.printerFilter;
    var fltStatus = this.viewModels.statusFilter;
    var fltPeriod = this.viewModels.periodFilter;

    self.octoprintFiles = undefined;

    self.requestInProgress = ko.observable(true);

    self.totalQuantity = ko.observable(undefined);
    self.totalDuration = ko.observable(undefined);

    self.searchQuery = ko.observable(undefined);
    self.searchQuery.subscribe(function () {
        self.performSearch();
    });

    self.currentSearchFilter = ko.observable(0);
    self.currentSearchFilter.subscribe(function () {
        self.performSearch();
    });

    fltUser.value.subscribe(function () {
        self.applyFilterChange();
    });
    fltPrinter.value.subscribe(function () {
        self.applyFilterChange();
    });
    fltStatus.value.subscribe(function () {
        self.applyFilterChange();
    });
    fltPeriod.value.subscribe(function () {
        self.applyFilterChange();
    });

    self.activeUser = undefined;
    loginLib.currentUser.subscribe(function () {
        var user = loginLib.currentUser();
        self.activeUser = user ? user.name : undefined;
    });

    self.activePrinter = undefined;
    connLib.selectedPrinter.subscribe(function () {
        var profile = _.findWhere(connLib.printerOptions(), { id: connLib.selectedPrinter() });
        self.activePrinter = profile ? profile.name : undefined;
    });

    self.supportedSorting = {
        fileAsc: function fileAsc(a, b) {
            return Utils.sortStrColAsc('file', a, b);
        },
        fileDesc: function fileDesc(a, b) {
            return Utils.sortStrColDesc('file', a, b);
        },
        userAsc: function userAsc(a, b) {
            return Utils.sortStrColAsc('user_name', a, b);
        },
        userDesc: function userDesc(a, b) {
            return Utils.sortStrColDesc('user_name', a, b);
        },
        printerAsc: function printerAsc(a, b) {
            return Utils.sortStrColAsc('printer_name', a, b);
        },
        printerDesc: function printerDesc(a, b) {
            return Utils.sortStrColDesc('printer_name', a, b);
        },
        startAsc: function startAsc(a, b) {
            return Utils.sortIntColAsc('start_time', a, b);
        },
        startDesc: function startDesc(a, b) {
            return Utils.sortIntColDesc('start_time', a, b);
        },
        durationAsc: function durationAsc(a, b) {
            return Utils.sortIntColAsc('duration', a, b);
        },
        durationDesc: function durationDesc(a, b) {
            return Utils.sortIntColDesc('duration', a, b);
        },
        statusAsc: function statusAsc(a, b) {
            return Utils.sortIntColAsc('status', a, b);
        },
        statusDesc: function statusDesc(a, b) {
            return Utils.sortIntColDesc('status', a, b);
        }
    };

    self.supportedFilters = {
        user: function user(data) {
            return fltUser.test(data.user_name);
        },
        printer: function printer(data) {
            return fltPrinter.test(data.printer_name);
        },
        status: function status(data) {
            return fltStatus.test(data.status);
        },
        period: function period(data) {
            return fltPeriod.test(data.start_time);
        }
    };

    self.supportedSearchFilters = [{
        name: gettext('File Name'),
        column: 'file'
    }, {
        name: gettext('Tag'),
        column: 'tag'
    }, {
        name: gettext('Notes'),
        column: 'notes'
    }];

    self.allJobs = new ItemListHelper('worklogHistory', self.supportedSorting, self.supportedFilters, 'startAsc', [], [], 10);

    self.allJobs.addFilter('user'); // add filter explicitly
    self.allJobs.addFilter('printer'); // add filter explicitly
    self.allJobs.addFilter('status'); // add filter explicitly
    self.allJobs.addFilter('period'); // add filter explicitly

    self.allJobs.items.subscribe(function () {
        self.updateTotals();
    });

    self.updateTotals = function updateJobsTotals() {
        var items = self.allJobs.items();
        var duration = 0;
        for (var i = 0, lim = items.length; i < lim; i += 1) {
            duration += items[i].duration;
        }
        self.totalQuantity(items.length);
        self.totalDuration(formatDuration(duration));
    };

    self.jobStatusText = function (status) {
        switch (status) {// eslint-disable-line default-case
            case db.STATUS_FAIL_SYS:
            case db.STATUS_FAIL_USER:
                return gettext('Failed');
            case db.STATUS_SUCCESS:
                return gettext('Printed');
            case db.STATUS_UNDEFINED:
                return gettext('Printing') + ' ...';
        }
        return '';
    };

    self.jobStatusClass = function (status) {
        switch (status) {// eslint-disable-line default-case
            case db.STATUS_FAIL_SYS:
            case db.STATUS_FAIL_USER:
                return 'text-error';
            case db.STATUS_SUCCESS:
            case db.STATUS_UNDEFINED:
                return 'text-success';
        }
        return '';
    };

    self.jobTag = function (tag) {
        return tag ? '#' + tag : '';
    };

    self.jobNotes = function (notes) {
        return notes ? '(' + notes + ')' : '';
    };

    /**
     * Clear search filter field and cancel filtering. Invoked on close button click in the filter input.
     */
    self.resetSearchFilter = function () {
        self.searchQuery(undefined);
        self.allJobs.resetSearch();
    };

    /**
     * Sort by the given column in ascending order.
     * Toggles sorting order if the journal is already sorted by that column.
     */
    self.setSorting = function (column) {
        var sortAsc = column + 'Asc';
        if (self.allJobs.currentSorting() === sortAsc) {
            self.allJobs.changeSorting(column + 'Desc');
        } else {
            self.allJobs.changeSorting(sortAsc);
        }
    };

    /**
     * Returns the appropriate icon to the column header depending on the given sort order.
     */
    self.sortIcon = function (column) {
        var cs = self.allJobs.currentSorting();
        if (cs.startsWith(column)) {
            return cs.endsWith('Asc') ? 'fa fa-sort-asc' : 'fa fa-sort-desc';
        }
        return '';
    };

    self.canBeEdited = function (item) {
        return item && item.user_name === self.activeUser;
    };

    self.canBePrinted = function (item) {
        if (item && item.printer_name === self.activePrinter && filesLib.enablePrint() && self.octoprintFiles) {
            return _.contains(self.octoprintFiles[item.origin], item.file_path);
        }
        return false;
    };

    self.printAgain = function (item) {
        if (filesLib.listHelper.isSelectedByMatcher(function (data) {
            return data && data.origin === item.origin && data.path === item.file_path;
        }) && filesLib.enablePrint(item)) {
            // file was already selected, just start the print job
            // console.log(item);
            OctoPrint.job.start();
        } else {
            OctoPrint.files.select(item.origin, item.file_path, true);
        }
    };

    self.pageSize = ko.pureComputed({
        read: function read() {
            return self.allJobs.pageSize();
        },
        write: function write(value) {
            self.allJobs.pageSize(Utils.validInt(value, self.allJobs.pageSize()));
        }
    });

    self.performSearch = function () {
        // eslint-disable-line func-names
        var query = self.searchQuery();
        if (query !== undefined && query !== '') {
            query = query.toLocaleLowerCase().trim();

            var filter = self.supportedSearchFilters[self.currentSearchFilter()];

            self.allJobs.changeSearchFunction(function (entry) {
                // eslint-disable-line func-names, prefer-arrow-callback
                return entry[filter.column].toLocaleLowerCase().indexOf(query) > -1;
            });
        } else {
            self.allJobs.resetSearch();
        }

        return false;
    };

    self.inProgress = ko.pureComputed(function () {
        // eslint-disable-line func-names, prefer-arrow-callback
        return self.requestInProgress() || fltPrinter.requestInProgress() || fltUser.requestInProgress();
    });

    self.applyFilterChange = function processFilterChange() {
        self.allJobs.refresh();
        self.allJobs.currentPage(0);
    };

    self.processJobs = function processRequestedJobs(data, opts) {
        if (opts === 'notmodified') return;
        self.allJobs.updateItems(data.jobs);
    };

    self.requestJobs = function requestAllJobsFromBackend(force) {
        self.requestInProgress(true);
        return api.job.list(force, { ifModified: true }).done(function (response, opts) {
            self.processJobs(response, opts);
        }).always(function () {
            self.requestInProgress(false);
        });
    };

    self.updateJob = function updateJobInBackend(item) {
        self.requestInProgress(true);
        api.job.update(item.id, item).done(function () {
            self.requestJobs();
        }).fail(function () {
            new PNotify({ // eslint-disable-line no-new
                title: gettext('Could not update job'),
                text: gettext('There was an unexpected error while updating the job, please consult the logs.'),
                type: 'error',
                hide: false
            });
            self.requestInProgress(false);
        });
    };

    self.updateOctoprintFiles = function updateOctoprintFilesRecursively(entry) {
        if (entry.type === 'folder') {
            _.each(entry.children, function (child) {
                self.updateOctoprintFiles(child);
            });
        } else {
            self.octoprintFiles[entry.origin].push(entry.path);
        }
    };

    self.processOctoprintFiles = function processOctoprintFilesRequest(data) {
        self.octoprintFiles = {
            local: [],
            sdcard: []
        };
        _.each(data.files, function (entry) {
            self.updateOctoprintFiles(entry);
        });
    };

    self.requestFiles = function requestOctoprintFiles() {
        self.requestInProgress(true);
        return OctoPrint.files.list(true).done(function (response) {
            self.processOctoprintFiles(response);
        }).always(function () {
            self.requestInProgress(false);
        });
    };
};
/* global WorkLog ko _ */

WorkLog.prototype.viewModels.record = function recordEditDialogViewModel() {
    var self = this.viewModels.record;
    var api = this.core.client;
    var jobs = this.viewModels.jobs;
    var db = this.core.common.jobStatus;

    var filesLib = this.core.bridge.allViewModels.filesViewModel;

    var FAILED = gettext('Failed');
    var SUCCESS = gettext('Printed');
    var PRINTING = gettext(gettext('Printing'));

    var statusEnableList = [{ name: FAILED, value: db.STATUS_FAIL_USER }, { name: SUCCESS, value: db.STATUS_SUCCESS }];

    var statusDisableList = [{ name: FAILED, value: db.STATUS_FAIL_SYS }, { name: PRINTING, value: db.STATUS_UNDEFINED }];

    self.statusDisabled = ko.observable(true);
    self.statusList = ko.observableArray([]);

    self.requestInProgress = ko.observable(false);

    self.showRecordDialog = function (data) {
        self.fromRecordData(data);
        //~ $('#dialog_job_edit_worklog').on('shown.bs.modal', self.ajustTextarea);
        $('#dialog_job_edit_worklog').modal('show');
    };

    //~ self.ajustTextarea = () => {
    //~ $('#dialog_job_edit_worklog').find('textarea').each(function () {
    //~ console.log($(this).height());
    //~ $(this).height('1em');
    //~ $(this).height($(this).prop('scrollHeight'));
    //~ });
    //~ }

    self.hideRecordDialog = function () {
        $('#dialog_job_edit_worklog').modal('hide');
    };

    /**
     * Holds the data for the record dialog. Every change in the form will be reflected by this
     * object.
     */
    self.loaded = {
        id: ko.observable(),
        file: ko.observable(),
        location: ko.observable(),
        fileExist: ko.observable(),
        user: ko.observable(),
        printer: ko.observable(),
        start: ko.observable(),
        end: ko.observable(),
        status: ko.observable(),
        tag: ko.observable(),
        notes: ko.observable(''), // Should not be undefined
        notesNew: ko.observable('')
    };

    /**
     * Updates the 'loaded' object with the data from the given record.
     */
    self.fromRecordData = function (data) {
        self.statusDisabled(_.findWhere(statusDisableList, { value: data.status }) !== undefined);
        self.statusList(self.statusDisabled() ? [].concat(statusEnableList, statusDisableList) : statusEnableList);

        self.loaded.id(data.id);
        self.loaded.file(data.file);
        self.loaded.location(data.origin + ': ' + data.file_path.slice(0, -data.file.length - 1));
        self.loaded.fileExist(data.printer_name === jobs.activePrinter && _.contains(jobs.octoprintFiles[data.origin], data.file_path));
        self.loaded.user(data.user_name);
        self.loaded.printer(data.printer_name);
        self.loaded.start(formatDate(data.start_time));
        self.loaded.end(formatDate(data.end_time));
        self.loaded.status(data.status);
        self.loaded.tag(data.tag);
        self.loaded.notes(data.notes);
        self.loaded.notesNew('');
    };

    /**
     * Returns a record object containing the data from the dialog
     */
    self.toRecordData = function () {
        var sep = self.loaded.notes() ? '; ' : '';
        var notesNew = self.loaded.notesNew() ? self.loaded.notesNew().trim() : '';

        var response = {
            id: self.loaded.id(),
            tag: self.loaded.tag().trim(),
            notes: self.loaded.notes() + (notesNew ? sep + notesNew : '')
        };

        if (!self.statusDisabled()) {
            response['status'] = self.loaded.status();
        }

        return response;
    };

    /**
     * Updates the passed record in the database.
     */
    self.updateRecord = function updateRecordInBackend() {
        var data = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : self.toRecordData();

        self.requestInProgress(true);
        api.job.update(data.id, data).done(function () {
            self.hideRecordDialog();
            //~ self.requestRecords();
        }).fail(function () {
            PNotify.error({
                title: gettext('Could not update record'),
                text: gettext('There was an unexpected error while updating the job record, please consult the logs.'),
                hide: false
            });
        }).always(function () {
            self.requestInProgress(false);
        });
    };
};
/* global WorkLog OCTOPRINT_VIEWMODELS */

(function registerViewModel() {
    var Plugin = new WorkLog();

    OCTOPRINT_VIEWMODELS.push({
        construct: Plugin.viewModel,
        dependencies: Plugin.REQUIRED_VIEWMODELS,
        elements: Plugin.BINDINGS
    });
})();