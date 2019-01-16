/* global WorkLog ItemListHelper ko gettext Utils OctoPrint _ */

WorkLog.prototype.viewModels.jobs = function jobsViewModel() {
    const self = this.viewModels.jobs;
    const api = this.core.client;

//    const printerState = this.core.bridge.allViewModels.printerStateViewModel;
//    const loginState = this.core.bridge.allViewModels.loginStateViewModel;
    const files = this.core.bridge.allViewModels.filesViewModel;

    const fltUser = this.viewModels.userFilter;
    const fltPrinter = this.viewModels.printerFilter;
    const fltStatus = this.viewModels.statusFilter;
    const fltPeriod = this.viewModels.periodFilter;

    self.activePrinter = undefined;
    self.searchQuery = ko.observable(undefined);
    self.searchQuery.subscribe(() => { self.performSearch(); });

    self.octoprintFiles = undefined;

    self.allJobs = new ItemListHelper(
        'worklogHistory',
        {
            fileAsc(a, b) {
                return Utils.sortStrColAsc('file', a, b);
            },
            fileDesc(a, b) {
                return Utils.sortStrColDesc('file', a, b);
            },
            userAsc(a, b) {
                return Utils.sortStrColAsc('user', a, b);
            },
            userDesc(a, b) {
                return Utils.sortStrColDesc('user', a, b);
            },
            printerAsc(a, b) {
                return Utils.sortStrColAsc('printer', a, b);
            },
            printerDesc(a, b) {
                return Utils.sortStrColDesc('printer', a, b);
            },
            startAsc(a, b) {
                return Utils.sortIntColAsc('start', a, b);
            },
            startDesc(a, b) {
                return Utils.sortIntColDesc('start', a, b);
            },
            timeAsc(a, b) {
                return Utils.sortIntColAsc('time', a, b);
            },
            timeDesc(a, b) {
                return Utils.sortIntColDesc('time', a, b);
            },
            statusAsc(a, b) {
                return Utils.sortIntColAsc('status', a, b);
            },
            statusDesc(a, b) {
                return Utils.sortIntColDesc('status', a, b);
            },
        },
        {
            user(data) {
                return fltUser.selected() === undefined || data.user === fltUser.selected();
            },
            printer(data) {
                return fltPrinter.selected() === undefined || data.printer === fltPrinter.selected();
            },
            status(data) {
                return fltStatus.selected() === undefined || data.status === fltStatus.selected();
            },
            period(data) {
                return fltPeriod.selected() === undefined || fltPeriod.isValid(data.start);
            },
        },
        'startAsc', [], [], 10,
    );

    self.jobStatusText = function getJobStatusText(status) {
        switch (status) { // eslint-disable-line default-case
        case 0:
            return gettext('Failed');
        case 1:
            return gettext('Printed');
        case -1:
            return `${gettext('Printing')} ...`;
        }
        return '';
    };

    self.jobNotes = function getJobNotes(notes) {
        if (notes) {
            return `(${notes})`;
        }
        return '';
    };

    self.jobStatusColor = function getJobStatusColor(status) {
        switch (status) { // eslint-disable-line default-case
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
        const sa = `${sorting}Asc`;
        if (self.allJobs.currentSorting() === sa) {
            self.allJobs.changeSorting(`${sorting}Desc`);
        } else {
            self.allJobs.changeSorting(sa);
        }
    };

    self.sortSymbol = function getSortDirectionSymbol(sorting) {
        const cs = self.allJobs.currentSorting();
        if (cs.startsWith(sorting)) {
            if (cs.endsWith('Asc')) {
                return '▴';
            }
            return '▾';
        }
        return '';
    };

    self.showPrintAgain = function canPrintAgain(item) {
        if (item.printer === self.activePrinter && files.enablePrint()) {
            return _.contains(self.octoprintFiles[item.origin], item.path);
        }

        return false;
    };

    self.printAgain = function loadAndPrintAgain(data) {
        if (!data) {
            return;
        }

        if (files.listHelper.isSelected(data) && files.enablePrint(data)) {
            // file was already selected, just start the print job
            OctoPrint.job.start();
        } else {
            // select file, start print job (if requested and within dimensions)
            const print = files.evaluatePrintDimensions(data, true);

            OctoPrint.files.select(data.origin, data.path, print);
        }
    };

    self.pageSize = ko.pureComputed({
        read() {
            return self.allJobs.pageSize();
        },
        write(value) {
            self.allJobs.pageSize(Utils.validInt(value, self.allJobs.pageSize()));
        },
    });

    self.performSearch = function () { // eslint-disable-line func-names
        let query = self.searchQuery().trim();
        if (query !== undefined && query !== '') {
            query = query.toLocaleLowerCase();

            const recursiveSearch = function (entry) { // eslint-disable-line func-names
                if (entry === undefined) {
                    return false;
                }
                return entry.file.toLocaleLowerCase().indexOf(query) > -1;
            };

            self.allJobs.changeSearchFunction(recursiveSearch);
        } else {
            self.allJobs.resetSearch();
        }

        return false;
    };

    self.inProgress = ko.pureComputed(function () { // eslint-disable-line func-names, prefer-arrow-callback
        return self.requestInProgress()
            || fltPrinter.requestInProgress()
            || fltUser.requestInProgress();
    });

    self.requestInProgress = ko.observable(false);

    self.processJobs = function processRequestedJobs(data) {
        self.allJobs.updateItems(data.jobs);
    };

    self.requestJobs = function requestAllJobsFromBackend(force) {
        self.requestInProgress(true);
        return api.job.list(force)
            .done((response) => { self.processJobs(response); })
            .always(() => { self.requestInProgress(false); });
    };

    self.processActivePrinter = function processRequestedActivePrinter(data) {
        const { printer } = data;
        if (printer !== undefined) {
            self.activePrinter = printer.name;
        }
    };

    self.requestActivePrinter = function requestActivePrinterFromBackend() {
        self.requestInProgress(true);
        return api.printer.get('@')
            .done((response) => { self.processActivePrinter(response); })
            .always(() => { self.requestInProgress(false); });
    };

    self.updateOctoprintFiles = function updateOctoprintFilesRecursively(entry) {
        if (entry.type === 'folder') {
            _.each(entry.children, (child) => { self.updateOctoprintFiles(child); });
        } else {
            self.octoprintFiles[entry.origin].push(entry.path);
        }
    };

    self.processOctoprintFiles = function processOctoprintFilesRequest(data) {
        self.octoprintFiles = {
            local: [],
            sdcard: [],
        };

        _.each(data.files, (entry) => { self.updateOctoprintFiles(entry); });
    };

    self.requestFiles = function requestOctorintFiles() {
        self.requestInProgress(true);
        return OctoPrint.files.list(true)
            .done((response) => { self.processOctoprintFiles(response); })
            .always(() => { self.requestInProgress(false); });
    };
};
