/* global WorkLog ItemListHelper ko gettext Utils OctoPrint PNotify formatDuration _ */

WorkLog.prototype.viewModels.jobs = function jobsViewModel() {
    const self = this.viewModels.jobs;
    const api = this.core.client;

    const filesLib = this.core.bridge.allViewModels.filesViewModel;
    const connLib = this.core.bridge.allViewModels.connectionViewModel;

    const fltUser = this.viewModels.userFilter;
    const fltPrinter = this.viewModels.printerFilter;
    const fltStatus = this.viewModels.statusFilter;
    const fltPeriod = this.viewModels.periodFilter;

    self.activePrinter = undefined;
    self.octoprintFiles = undefined;

    self.totalQuantity = ko.observable(undefined);
    self.totalDuration = ko.observable(undefined);

    self.requestInProgress = ko.observable(false);
    self.searchQuery = ko.observable(undefined);

    self.searchQuery.subscribe(() => { self.performSearch(); });

    fltUser.selected.subscribe(() => { self.applyFilterChange(); });
    fltPrinter.selected.subscribe(() => { self.applyFilterChange(); });
    fltStatus.selected.subscribe(() => { self.applyFilterChange(); });
    fltPeriod.selected.subscribe(() => { self.applyFilterChange(); });

    connLib.selectedPrinter.subscribe(() => { self.processActivePrinter(); });

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
                return Utils.sortStrColAsc('user_name', a, b);
            },
            userDesc(a, b) {
                return Utils.sortStrColDesc('user_name', a, b);
            },
            printerAsc(a, b) {
                return Utils.sortStrColAsc('printer_name', a, b);
            },
            printerDesc(a, b) {
                return Utils.sortStrColDesc('printer_name', a, b);
            },
            startAsc(a, b) {
                return Utils.sortIntColAsc('start_time', a, b);
            },
            startDesc(a, b) {
                return Utils.sortIntColDesc('start_time', a, b);
            },
            durationAsc(a, b) {
                return Utils.sortIntColAsc('duration', a, b);
            },
            durationDesc(a, b) {
                return Utils.sortIntColDesc('duration', a, b);
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
                return fltUser.test(data.user_name);
            },
            printer(data) {
                return fltPrinter.test(data.printer_name);
            },
            status(data) {
                return fltStatus.test(data.status);
            },
            period(data) {
                return fltPeriod.test(data.start_time);
            },
        },
        'startAsc', [], [], 10,
    );

    self.allJobs.addFilter('user'); // add filter explicitly
    self.allJobs.addFilter('printer'); // add filter explicitly
    self.allJobs.addFilter('status'); // add filter explicitly
    self.allJobs.addFilter('period'); // add filter explicitly

    self.allJobs.items.subscribe(() => { self.updateTotals(); });

    self.updateTotals = function updateJobsTotals() {
        const items = self.allJobs.items();
        let duration = 0;
        for (let i = 0, lim = items.length; i < lim; i += 1) {
            duration += items[i].duration;
        }
        self.totalQuantity(items.length);
        self.totalDuration(formatDuration(duration));
    };

    self.jobStatusTitle = function getJobStatusTitle(item) {
        return !item || item.notes || item.status == -1 ? '' : gettext('Double-click to toggle');
    };

    self.jobStatusToggle = function processJobStatusDoubleClick(item) {
        if (!item || item.notes || item.status == -1) return;
        const itemCopy = item;
        itemCopy.status = item.status === 0 ? 1 : 0;
        self.updateJob(itemCopy);
    };

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
            const print = filesLib.evaluatePrintDimensions(item, true);

            OctoPrint.files.select(item.origin, item.file_path, print);
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

            self.allJobs.changeSearchFunction(function (entry) { // eslint-disable-line func-names, prefer-arrow-callback
                return entry.file.toLocaleLowerCase().indexOf(query) > -1;
            });
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

    self.applyFilterChange = function processFilterChange() {
        self.allJobs.refresh();
        self.allJobs.currentPage(0);
    };

    self.processJobs = function processRequestedJobs(data) {
        self.allJobs.updateItems(data.jobs);
    };

    self.requestJobs = function requestAllJobsFromBackend(force) {
        self.requestInProgress(true);
        return api.job.list(force)
            .done((response) => { self.processJobs(response); })
            .always(() => { self.requestInProgress(false); });
    };

    self.updateJob = function updateJobInBackend(item) {
        self.requestInProgress(true);
        api.job.update(item.id, item)
            .done(() => {
                self.requestJobs();
            })
            .fail(() => {
                new PNotify({ // eslint-disable-line no-new
                    title: gettext('Could not update job'),
                    text: gettext('There was an unexpected error while updating the job, please consult the logs.'),
                    type: 'error',
                    hide: false,
                });
                self.requestInProgress(false);
            });
    };

    self.processActivePrinter = function processActivePrinterChange() {
        const profile = _.findWhere(connLib.printerOptions(), { id: connLib.selectedPrinter() });
        self.activePrinter = profile ? profile.name : undefined;
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

    self.requestFiles = function requestOctoprintFiles() {
        self.requestInProgress(true);
        return OctoPrint.files.list(true)
            .done((response) => { self.processOctoprintFiles(response); })
            .always(() => { self.requestInProgress(false); });
    };
};
