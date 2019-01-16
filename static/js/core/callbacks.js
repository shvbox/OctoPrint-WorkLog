/* global WorkLog Utils _ */

WorkLog.prototype.core.callbacks = function octoprintCallbacks() {
    const self = this;

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
        const requests = [
            self.viewModels.userFilter.requestUsers,
            self.viewModels.userFilter.requestActiveUser,
            self.viewModels.printerFilter.requestPrinters,
            self.viewModels.printerFilter.requestActivePrinter,
            self.viewModels.jobs.requestActivePrinter,
            self.viewModels.jobs.requestJobs,
        ];

        // We chain them because, e.g. selections depends on spools
        Utils.runRequestChain(requests);
    };

    self.onDataUpdaterPluginMessage = function onDataUpdaterPluginMessageCallback(plugin, data) {
        if (plugin !== 'worklog') return;

        const messageType = data.type;
        // const messageData = data.data;
        // TODO needs improvement
        if (messageType === 'data_changed') {
            self.viewModels.userFilter.requestUsers();
            self.viewModels.printerFilter.requestPrinters();
            self.viewModels.jobs.requestActivePrinter();
            self.viewModels.jobs.requestFiles();
            self.viewModels.jobs.requestJobs();
        }
    };

    self.onEventFileRemoved = function onFileRemoved(payload) {
        self.onFilesUpdated(payload);
    };

    self.onEventFileAdded = function onFileAdded(payload) {
        self.onFilesUpdated(payload);
    };

    self.onEventFolderRemoved = function onFolderRemoved(payload) {
        self.onFilesUpdated(payload);
    };

    self.onFilesUpdated = function onFilesUpdatedHelper(payload) {
        const { type } = payload;
        if (!(type === undefined || _.contains(type, 'machinecode'))) return;

        const requests = [
            self.viewModels.jobs.requestFiles,
            self.viewModels.jobs.requestJobs,
        ];
        Utils.runRequestChain(requests);
    };
};
