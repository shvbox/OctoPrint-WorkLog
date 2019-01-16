/* global WorkLog ko */

WorkLog.prototype.viewModels.printerFilter = function printerFilterViewModel() {
    const self = this.viewModels.printerFilter;
    const api = this.core.client;
    const history = this.viewModels.jobs;

    self.allItems = ko.observableArray([]);
    self.selected = ko.observable();
    self.requestInProgress = ko.observable(false);

    history.allJobs.addFilter('printer');

    self.changed = function printerFilterChanged() {
        history.allJobs.refresh();
        history.allJobs.currentPage(0);
    };

    self.processPrinters = function processRequestedPrinters(data) {
        let { printers } = data;
        if (printers === undefined) printers = [];
        self.allItems(printers);
    };

    self.processActivePrinter = function processRequestedActivePrinter(data) {
        const { printer } = data;
        if (printer !== undefined) {
            self.selected(printer.name);
        }
    };

    self.requestActivePrinter = function requestActivePrinterFromBackend() {
        self.requestInProgress(true);
        return api.printer.get('@')
            .done((response) => { self.processActivePrinter(response); })
            .always(() => { self.requestInProgress(false); });
    };

    self.requestPrinters = function requestAllPrintersFromBackend(force) {
        self.requestInProgress(true);
        return api.printer.list(force)
            .done((response) => { self.processPrinters(response); })
            .always(() => { self.requestInProgress(false); });
    };
};
