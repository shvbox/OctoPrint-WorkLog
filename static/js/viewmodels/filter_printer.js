/* global WorkLog ko _ gettext */

WorkLog.prototype.viewModels.printerFilter = function printerFilterViewModel() {
    const self = this.viewModels.printerFilter;
    const api = this.core.client;

    const connLib = this.core.bridge.allViewModels.connectionViewModel;

    const THIS = gettext('This');

    self.activePrinter = undefined;
    connLib.selectedPrinter.subscribe(() => {
        const profile = _.findWhere(connLib.printerOptions(), { id: connLib.selectedPrinter() });
        self.activePrinter = profile ? profile.name : undefined;
    });

    self.allItems = ko.observableArray([]);
    self.selected = ko.observable(undefined);
    self.value = ko.observable(undefined);

    self.requestInProgress = ko.observable(false);

    self.changed = () => {
        if (self.selected() === THIS) {
            self.selected(self.activePrinter);
        }
        self.value(self.selected());
    };

    self.test = value => self.value() === undefined || value === self.value();

    self.processPrinters = (data, opts) => {
        // console.log(opts);
        if (opts === 'notmodified') return;

        const firstRun = self.allItems().length === 0;
        let printerInList = undefined;
        let { printers } = data;

        if (printers === undefined) {
            printers = [];
        } else if (self.activePrinter) {
            printerInList = _.find(printers, entry => entry.name === self.activePrinter);
            if (printerInList) {
                printers = [{ name: THIS }, ...printers];
            }
        }

        self.allItems(printers);

        if (firstRun) {
            self.selected(printerInList ? self.activePrinter : undefined);
            self.changed();
        }
    };

    self.requestPrinters = (force) => {
        self.requestInProgress(true);
        return api.printer.list(force, { ifModified: true })
            .done((response, opts) => { self.processPrinters(response, opts); })
            .always(() => { self.requestInProgress(false); });
    };
};
