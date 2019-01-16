/* global WorkLog  _ */

WorkLog.prototype.core.bridge = function pluginBridge() {
    const self = this;

    self.core.bridge = {
        allViewModels: {},

        REQUIRED_VIEWMODELS: [
            'settingsViewModel',
            'printerStateViewModel',
            'loginStateViewModel',
            'filesViewModel',
        ],

        BINDINGS: [
            '#tab_plugin_worklog',
        ],

        viewModel: function WorkLogViewModel(viewModels) {
            self.core.bridge.allViewModels = _.object(self.core.bridge.REQUIRED_VIEWMODELS, viewModels);
            self.core.callbacks.call(self);

            Object.values(self.viewModels).forEach(viewModel => viewModel.call(self));

            return self;
        },
    };

    return self.core.bridge;
};
