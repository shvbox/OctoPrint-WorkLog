/* global WorkLog Utils _ */

WorkLog.prototype.core.callbacks = function octoprintCallbacks() {
    const self = this;

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
        const requests = [
            self.viewModels.userFilter.requestUsers,
            self.viewModels.printerFilter.requestPrinters,
            self.viewModels.jobs.requestFiles,
            self.viewModels.jobs.requestJobs,
        ];

        // We chain them because, e.g. selections depends on spools
        Utils.runRequestChain(requests);
    };

    self.onSettingsBeforeSave = function onSettingsBeforeSaveCallback() {
        self.viewModels.config.saveData();
    };

    self.onDataUpdaterPluginMessage = function onDataUpdaterPluginMessageCallback(plugin, message) {
        if (plugin !== 'worklog') return;

        const { type, data } = message;
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
        const { type } = data;
        if (!(type === undefined || _.contains(type, 'machinecode'))) return;

        const requests = [
            self.viewModels.jobs.requestFiles,
            self.viewModels.jobs.requestJobs,
        ];
        Utils.runRequestChain(requests);
    };
};
