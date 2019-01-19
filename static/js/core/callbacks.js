/* global WorkLog Utils _ */

WorkLog.prototype.core.callbacks = function octoprintCallbacks() {
    const self = this;
    const usersLib = this.core.bridge.allViewModels.loginStateViewModel;

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
            self.viewModels.printerFilter.requestPrinters,
            self.viewModels.jobs.requestFiles,
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
        const { type } = data;
        if (!(type === undefined || _.contains(type, 'machinecode'))) return;

        const requests = [
            self.viewModels.jobs.requestFiles,
            self.viewModels.jobs.requestJobs,
        ];
        Utils.runRequestChain(requests);
    };
};
