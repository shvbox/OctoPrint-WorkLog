/* global WorkLog ko $ */

WorkLog.prototype.viewModels.config = function configurationViewModel() {
    const self = this.viewModels.config;
    const api = this.core.client;
    const { settingsViewModel } = this.core.bridge.allViewModels;

    self.config = ko.mapping.fromJS({});

    self.saveData = () => {
        settingsViewModel.settings.plugins.worklog = ko.mapping.toJS(self.config);
    };

    self.loadData = () => {
        const pluginSettings = settingsViewModel.settings.plugins.worklog;
        ko.mapping.fromJS(ko.toJS(pluginSettings), self.config);
        console.log(self.config.database.useExternal());
        console.log(self.config.database.uri());
        console.log(self.config.database.user());
    };

    self.connectionTest = (viewModel, event) => {
        console.log('connectionTest');
        const target = $(event.target);
        target.removeClass('btn-success btn-danger');
        target.prepend('<i class="fa fa-spinner fa-spin"></i> ');
        target.prop('disabled', true);

        const data = ko.mapping.toJS(self.config.database);

        api.database.test(data)
            .done(() => {
                target.addClass('btn-success');
            })
            .fail(() => {
                target.addClass('btn-danger');
            })
            .always(() => {
                $('i.fa-spinner', target).remove();
                target.prop('disabled', false);
            });
    };
};
