/* global WorkLog ko */

WorkLog.prototype.viewModels.printerFilter = function printerFilterViewModel() {
    const self = this.viewModels.printerFilter;
    const api = this.core.client;
    const history = this.viewModels.jobs;

    const connLib = this.core.bridge.allViewModels.connectionViewModel;

    self.allItems = ko.observableArray([]);
    self.selected = ko.observable();
    self.requestInProgress = ko.observable(false);
    
    self.printerChanged = false;
    connLib.selectedPrinter.subscribe(() => { self.printerChanged = true; });

    history.allJobs.addFilter('printer');

    self.changed = function printerFilterChanged() {
        history.allJobs.refresh();
        history.allJobs.currentPage(0);
    };

    self.processPrinters = function processRequestedPrinters(data) {
        let { printers } = data;
        if (printers === undefined) printers = [];
        self.allItems(printers);
        
        if (self.printerChanged) {
            profile = _.findWhere(connLib.printerOptions(), { id: connLib.selectedPrinter() })
            self.selected(profile ? profile.name : undefined);

            self.printerChanged = false;
        }
    };

    self.requestPrinters = function requestAllPrintersFromBackend(force) {
        self.requestInProgress(true);
        return api.printer.list(force)
            .done((response) => { self.processPrinters(response); })
            .always(() => { self.requestInProgress(false); });
    };
};
