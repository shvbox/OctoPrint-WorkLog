/*
 * View model for OctoPrint-WorkLog
 *
 * Author: Alexander Shvetsov <shv-box@mail.com> based on FilamentManager by Sven Lohrmann <malnvenshorn@gmail.com>
 *
 * License: AGPLv3
 */

var WorkLog = function WorkLog() {
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

        BINDINGS: ['#tab_plugin_worklog'],

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
    // self.viewModels.warning.replaceFilamentView();
    // };

    // self.onBeforeBinding = function onBeforeBindingCallback() {
    // self.viewModels.config.loadData();
    // self.viewModels.selections.setArraySize();
    // self.viewModels.selections.setSubscriptions();
    // self.viewModels.warning.setSubscriptions();
    // };

    self.onStartupComplete = function onStartupCompleteCallback() {
        var requests = [self.viewModels.userFilter.requestUsers, self.viewModels.printerFilter.requestPrinters, self.viewModels.jobs.requestFiles, self.viewModels.jobs.requestJobs];

        // We chain them because, e.g. selections depends on spools
        Utils.runRequestChain(requests);
    };

    self.onDataUpdaterPluginMessage = function onDataUpdaterPluginMessageCallback(plugin, data) {
        if (plugin !== 'worklog') return;

        var messageType = data.type;
        // const messageData = data.data;
        // TODO needs improvement
        if (messageType === 'data_changed') {
            self.viewModels.userFilter.requestUsers();
            self.viewModels.printerFilter.requestPrinters();
            self.viewModels.jobs.requestJobs();
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

    var jobUrl = function apiJobNamespace(job) {
        var url = pluginUrl + '/jobs';
        return job === undefined ? url : url + '/' + job;
    };

    var userUrl = function apiUserNamespace(user) {
        var url = pluginUrl + '/users';
        return user === undefined ? url : url + '/' + user;
    };

    var printerUrl = function apiPrinterNamespace(printer) {
        var url = pluginUrl + '/printers';
        return printer === undefined ? url : url + '/' + printer;
    };

    var totalsUrl = function apiTotalsNamespace() {
        return pluginUrl + '/totals';
    };

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
/* global WorkLog ko gettext */

WorkLog.prototype.viewModels.periodFilter = function periodFilterViewModel() {
    var self = this.viewModels.periodFilter;

    self.allItems = ko.observableArray([{ name: gettext('Day'), value: 0 }, { name: gettext('Week'), value: 1 }, { name: gettext('Month'), value: 2 }, { name: gettext('Year'), value: 3 }]);
    self.selected = ko.observable();
    self.preSelected = ko.observable();

    self.begin = -1;
    self.end = -1;

    self.changed = function periodFilterChanged() {
        var now = new Date();
        var y = now.getFullYear();
        var m = now.getMonth();
        var d = now.getDate();

        switch (self.preSelected()) {
            case 0:
                self.begin = new Date(y, m, d).getTime() / 1000;
                self.end = new Date(y, m, d + 1).getTime() / 1000;
                break;
            case 1:
                {
                    var day = now.getDay();
                    var dw = d - day - (day === 0 ? 6 : -1);
                    self.begin = new Date(y, m, dw).getTime() / 1000;
                    self.end = new Date(y, m, dw + 8).getTime() / 1000;
                }
                break;
            case 2:
                self.begin = new Date(y, m).getTime() / 1000;
                self.end = new Date(y, m + 1, 1).getTime() / 1000;
                break;
            case 3:
                self.begin = new Date(y, 0).getTime() / 1000;
                self.end = new Date(y + 1, 0, 1).getTime() / 1000;
                break;
            default:
                self.begin = -1;
                self.end = -1;
        }

        self.selected(self.preSelected());

        // console.log('periodFilterChanged: ' + self.begin + ' - ' + self.end);
    };

    self.test = function testDataValue(value) {
        return self.selected() === undefined || self.begin < 0 || value >= self.begin && value < self.end;
    };
};
/* global WorkLog ko _ */

WorkLog.prototype.viewModels.printerFilter = function printerFilterViewModel() {
    var self = this.viewModels.printerFilter;
    var api = this.core.client;

    var connLib = this.core.bridge.allViewModels.connectionViewModel;

    self.allItems = ko.observableArray([]);
    self.selected = ko.observable();

    self.requestInProgress = ko.observable(false);

    self.printerChanged = false;
    connLib.selectedPrinter.subscribe(function () {
        self.printerChanged = true;
    });

    self.test = function testDataValue(value) {
        return self.selected() === undefined || value === self.selected();
    };

    self.processPrinters = function processRequestedPrinters(data) {
        var printers = data.printers;

        if (printers === undefined) printers = [];
        self.allItems(printers);

        if (self.printerChanged) {
            var profile = _.findWhere(connLib.printerOptions(), { id: connLib.selectedPrinter() });
            self.selected(profile ? profile.name : undefined);

            self.printerChanged = false;
        }
    };

    self.requestPrinters = function requestAllPrintersFromBackend(force) {
        self.requestInProgress(true);
        return api.printer.list(force).done(function (response) {
            self.processPrinters(response);
        }).always(function () {
            self.requestInProgress(false);
        });
    };
};
/* global WorkLog ko gettext */

WorkLog.prototype.viewModels.statusFilter = function statusFilterViewModel() {
    var self = this.viewModels.statusFilter;

    self.allItems = ko.observableArray([{ name: gettext('Printed'), value: 1 }, { name: gettext('Failed'), value: 0 }, { name: gettext('In Print'), value: -1 }]);
    self.selected = ko.observable();

    self.test = function testDataValue(value) {
        return self.selected() === undefined || value === self.selected();
    };
};
/* global WorkLog ko */

WorkLog.prototype.viewModels.userFilter = function userFilterViewModel() {
    var self = this.viewModels.userFilter;
    var api = this.core.client;

    var loginLib = this.core.bridge.allViewModels.loginStateViewModel;

    self.allItems = ko.observableArray([]);
    self.selected = ko.observable(undefined);
    self.requestInProgress = ko.observable(false);

    self.userChanged = false;
    loginLib.currentUser.subscribe(function () {
        self.userChanged = true;
    });

    self.test = function testDataValue(value) {
        return self.selected() === undefined || value === self.selected();
    };

    self.processUsers = function processRequestedUsers(data) {
        var users = data.users;

        if (users === undefined) users = [];
        self.allItems(users);

        if (self.userChanged) {
            var user = loginLib.currentUser();
            self.selected(user ? user.name : undefined);
            self.userChanged = false;
        }
    };

    self.requestUsers = function requestAllUsersFromBackend(force) {
        self.requestInProgress(true);
        return api.user.list(force).done(function (response) {
            self.processUsers(response);
        }).always(function () {
            self.requestInProgress(false);
        });
    };
};
/* global WorkLog ItemListHelper ko gettext Utils OctoPrint PNotify formatDuration _ */

WorkLog.prototype.viewModels.jobs = function jobsViewModel() {
    var self = this.viewModels.jobs;
    var api = this.core.client;

    var filesLib = this.core.bridge.allViewModels.filesViewModel;
    var connLib = this.core.bridge.allViewModels.connectionViewModel;

    var fltUser = this.viewModels.userFilter;
    var fltPrinter = this.viewModels.printerFilter;
    var fltStatus = this.viewModels.statusFilter;
    var fltPeriod = this.viewModels.periodFilter;

    self.activePrinter = undefined;
    self.octoprintFiles = undefined;

    self.totalQuantity = ko.observable(undefined);
    self.totalDuration = ko.observable(undefined);

    self.requestInProgress = ko.observable(false);
    self.searchQuery = ko.observable(undefined);

    self.searchQuery.subscribe(function () {
        self.performSearch();
    });

    fltUser.selected.subscribe(function () {
        self.applyFilterChange();
    });
    fltPrinter.selected.subscribe(function () {
        self.applyFilterChange();
    });
    fltStatus.selected.subscribe(function () {
        self.applyFilterChange();
    });
    fltPeriod.selected.subscribe(function () {
        self.applyFilterChange();
    });

    connLib.selectedPrinter.subscribe(function () {
        self.processActivePrinter();
    });

    self.allJobs = new ItemListHelper('worklogHistory', {
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
    }, {
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
    }, 'startAsc', [], [], 10);

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

    self.jobStatusTitle = function getJobStatusTitle(item) {
        return !item || item.notes || item.status === -1 ? '' : gettext('Double-click to toggle');
    };

    self.jobStatusToggle = function processJobStatusDoubleClick(item) {
        if (!item || item.notes || item.status === -1) return;
        var itemCopy = item;
        itemCopy.status = item.status === 0 ? 1 : 0;
        self.updateJob(itemCopy);
    };

    self.jobStatusText = function getJobStatusText(status) {
        switch (status) {// eslint-disable-line default-case
            case 0:
                return gettext('Failed');
            case 1:
                return gettext('Printed');
            case -1:
                return gettext('Printing') + ' ...';
        }
        return '';
    };

    self.jobNotes = function getJobNotes(notes) {
        if (notes) {
            return '(' + notes + ')';
        }
        return '';
    };

    self.jobStatusColor = function getJobStatusColor(status) {
        switch (status) {// eslint-disable-line default-case
            case 0:
                return 'red';
            case 1:
                return 'green';
            case -1:
                return 'gray';
        }
        return '';
    };

    self.changeSorting = function changeJobsSorting(sorting) {
        var sa = sorting + 'Asc';
        if (self.allJobs.currentSorting() === sa) {
            self.allJobs.changeSorting(sorting + 'Desc');
        } else {
            self.allJobs.changeSorting(sa);
        }
    };

    self.sortSymbol = function getSortDirectionSymbol(sorting) {
        var cs = self.allJobs.currentSorting();
        if (cs.startsWith(sorting)) {
            if (cs.endsWith('Asc')) {
                return '▴';
            }
            return '▾';
        }
        return '';
    };

    self.showPrintAgain = function canPrintAgain(item) {
        if (item.printer_name === self.activePrinter && filesLib.enablePrint() && self.octoprintFiles) {
            return _.contains(self.octoprintFiles[item.origin], item.file_path);
        }

        return false;
    };

    self.printAgain = function loadAndPrintAgain(item) {
        if (!item) return;
        //~ console.log('printAgain');

        if (filesLib.listHelper.isSelected(item) && filesLib.enablePrint(item)) {
            // file was already selected, just start the print job
            OctoPrint.job.start();
        } else {
            // select file, start print job (if requested and within dimensions)
            var print = filesLib.evaluatePrintDimensions(item, true);

            OctoPrint.files.select(item.origin, item.file_path, print);
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
        var query = self.searchQuery().trim();
        if (query !== undefined && query !== '') {
            query = query.toLocaleLowerCase();

            self.allJobs.changeSearchFunction(function (entry) {
                // eslint-disable-line func-names, prefer-arrow-callback
                return entry.file.toLocaleLowerCase().indexOf(query) > -1;
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

    self.processJobs = function processRequestedJobs(data) {
        self.allJobs.updateItems(data.jobs);
    };

    self.requestJobs = function requestAllJobsFromBackend(force) {
        self.requestInProgress(true);
        return api.job.list(force).done(function (response) {
            self.processJobs(response);
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

    self.processActivePrinter = function processActivePrinterChange() {
        var profile = _.findWhere(connLib.printerOptions(), { id: connLib.selectedPrinter() });
        self.activePrinter = profile ? profile.name : undefined;
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
/* global WorkLog OCTOPRINT_VIEWMODELS */

(function registerViewModel() {
    var Plugin = new WorkLog();

    OCTOPRINT_VIEWMODELS.push({
        construct: Plugin.viewModel,
        dependencies: Plugin.REQUIRED_VIEWMODELS,
        elements: Plugin.BINDINGS
    });
})();