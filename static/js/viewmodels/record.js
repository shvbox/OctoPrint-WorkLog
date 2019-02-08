/* global WorkLog ko _ */

WorkLog.prototype.viewModels.record = function recordEditDialogViewModel() {
    const self = this.viewModels.record;
    const api = this.core.client;
    const jobs = this.viewModels.jobs;
    const db = this.core.common.jobStatus;
    
    const filesLib = this.core.bridge.allViewModels.filesViewModel;

    const FAILED = gettext('Failed');
    const SUCCESS = gettext('Printed');
    const PRINTING = gettext(gettext('Printing'));

    const statusEnableList = [
        { name: FAILED, value: db.STATUS_FAIL_USER },
        { name: SUCCESS, value: db.STATUS_SUCCESS },
    ];

    const statusDisableList = [
        { name: FAILED, value: db.STATUS_FAIL_SYS },
        { name: PRINTING, value: db.STATUS_UNDEFINED },
    ];

    self.statusDisabled = ko.observable(true);
    self.statusList = ko.observableArray([]);

    self.requestInProgress = ko.observable(false);

    self.showRecordDialog = (data) => {
        self.fromRecordData(data);
        //~ $('#dialog_job_edit_worklog').on('shown.bs.modal', self.ajustTextarea);
        $('#dialog_job_edit_worklog').modal('show');
    };

    //~ self.ajustTextarea = () => {
        //~ $('#dialog_job_edit_worklog').find('textarea').each(function () {
            //~ console.log($(this).height());
            //~ $(this).height('1em');
            //~ $(this).height($(this).prop('scrollHeight'));
        //~ });
    //~ }

    self.hideRecordDialog = () => {
        $('#dialog_job_edit_worklog').modal('hide');
    };

    /**
     * Holds the data for the record dialog. Every change in the form will be reflected by this
     * object.
     */
    self.loaded = {
        id: ko.observable(),
        file: ko.observable(),
        location: ko.observable(),
        fileExist: ko.observable(),
        user: ko.observable(),
        printer: ko.observable(),
        start: ko.observable(),
        end: ko.observable(),
        status: ko.observable(),
        tag: ko.observable(),
        notes: ko.observable(''), // Should not be undefined
        notesNew: ko.observable(''),
    };

    /**
     * Updates the 'loaded' object with the data from the given record.
     */
    self.fromRecordData = (data) => {
        self.statusDisabled(_.findWhere(statusDisableList, { value: data.status }) !== undefined);
        self.statusList(self.statusDisabled() ? [...statusEnableList, ...statusDisableList] : statusEnableList);

        self.loaded.id(data.id);
        self.loaded.file(data.file);
        self.loaded.location(`${data.origin}: ${data.file_path.slice(0, -data.file.length - 1)}`);
        self.loaded.fileExist(data.printer_name === jobs.activePrinter && _.contains(jobs.octoprintFiles[data.origin], data.file_path));
        self.loaded.user(data.user_name);
        self.loaded.printer(data.printer_name);
        self.loaded.start(formatDate(data.start_time));
        self.loaded.end(formatDate(data.end_time));
        self.loaded.status(data.status);
        self.loaded.tag(data.tag);
        self.loaded.notes(data.notes);
        self.loaded.notesNew('');
    };

    /**
     * Returns a record object containing the data from the dialog
     */
    self.toRecordData = () => {
        const sep = self.loaded.notes() ? '; ' : '';
        const notesNew = self.loaded.notesNew() ? self.loaded.notesNew().trim() : '';

        let response = {
            id: self.loaded.id(),
            tag: self.loaded.tag().trim(),
            notes: self.loaded.notes() + (notesNew ? sep + notesNew : ''),
        };

        if (!self.statusDisabled()) {
            response['status'] = self.loaded.status();
        }

        return response;
    };

    /**
     * Updates the passed record in the database.
     */
    self.updateRecord = function updateRecordInBackend(data = self.toRecordData()) {
        self.requestInProgress(true);
        api.job.update(data.id, data)
            .done(() => {
                self.hideRecordDialog();
                //~ self.requestRecords();
            })
            .fail(() => {
                PNotify.error({
                    title: gettext('Could not update record'),
                    text: gettext('There was an unexpected error while updating the job record, please consult the logs.'),
                    hide: false,
                });
            }).always(() => {
                self.requestInProgress(false);
            });
    };
}
