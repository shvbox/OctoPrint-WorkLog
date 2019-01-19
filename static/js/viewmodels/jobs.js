/* global WorkLog ItemListHelper ko gettext Utils OctoPrint _ */

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
                return fltUser.selected() === undefined || data.user_name === fltUser.selected();
            },
            printer(data) {
                return fltPrinter.selected() === undefined || data.printer_name === fltPrinter.selected();
            },
            status(data) {
                return fltStatus.selected() === undefined || data.status === fltStatus.selected();
            },
            period(data) {
                return fltPeriod.selected() === undefined || fltPeriod.isValid(data.start_time);
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
        if (item.printer_name === self.activePrinter && filesLib.enablePrint() && self.octoprintFiles) {
            return _.contains(self.octoprintFiles[item.origin], item.file_path);
        }

        return false;
    };

    self.printAgain = function loadAndPrintAgain(data) {
        if (!data) {
            return;
        }

        if (filesLib.listHelper.isSelected(data) && filesLib.enablePrint(data)) {
            // file was already selected, just start the print job
            OctoPrint.job.start();
        } else {
            // select file, start print job (if requested and within dimensions)
            const print = filesLib.evaluatePrintDimensions(data, true);

            OctoPrint.files.select(data.origin, data.file_path, print);
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

    //~ self.allJobs.items.subscribe(function(newValue) {
        //~ var totalTime = 0;
        //~ var totalUsage = {
            //~ length: 0,
            //~ volume: 0
        //~ };
        //~ var averageUsage = {
            //~ length: 0,
            //~ volume: 0
        //~ };
//~ 
        //~ var itemList = newValue;
        //~ var itemListLength = itemList.length;
        //~ for (var i = 0; i < itemListLength; i++) {
            //~ totalTime += itemList[i].printTime();
//~ 
            //~ totalUsage.length += itemList[i].filamentLength();
            //~ totalUsage.volume += itemList[i].filamentVolume();
        //~ }
//~ 
        //~ self.totalTime(formatDuration(totalTime));
        //~ self.totalUsage(formatFilament(totalUsage));
//~ 
        //~ averageUsage.length = totalUsage.length / itemListLength;
        //~ averageUsage.volume = totalUsage.volume / itemListLength;
//~ 
        //~ self.averageTime(formatDuration(totalTime / itemListLength));
        //~ self.averageUsage(formatFilament(averageUsage));
    //~ });
//~ 
    //~ self.updateTotals = function updateHistoryTotals() {
        //~ if (self.allJobs.searchFunction) {
            //~ self.calculateTotals();
        //~ } else {
            //~ self.requestTotals();
        //~ }
    //~ }

    self.onFilterChanged = function processFilterChanger() {
        self.allJobs.refresh();
        self.allJobs.currentPage(0);
        self.requestTotals(true);
    }
    
    self.processJobs = function processRequestedJobs(data) {
        self.allJobs.updateItems(data.jobs);
    };

    self.requestJobs = function requestAllJobsFromBackend(force) {
        self.requestInProgress(true);
        return api.job.list(force)
            .done((response) => { self.processJobs(response); })
            .always(() => { self.requestInProgress(false); });
    };

    self.processActivePrinter = function processActivePrinterChange() {
        profile = _.findWhere(connLib.printerOptions(), { id: connLib.selectedPrinter() })
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

    self.processTotals = function processRequestedTotals(data) {
        const { totals } = data;
        //~ Utils.printJSON(totals);
        if (totals !== undefined) {;
            self.totalQuantity(totals.total_quantity);
            self.totalDuration(formatDuration(Utils.validInt(totals.total_duration)));
        }
    };

    self.requestTotals = function requestTotalsFromBackend(force) {
        self.requestInProgress(true);
        const filters = {
            user: fltUser.selected(),
            printer: fltPrinter.selected(),
            status: fltStatus.selected(),
            begin: fltPeriod.begin,
            end: fltPeriod.end,
        }
            
        return api.totals.get(force, filters)
            .done((response) => { self.processTotals(response); })
            .always(() => { self.requestInProgress(false); });
    };
};
