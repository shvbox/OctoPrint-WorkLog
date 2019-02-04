/*
 * View model for OctoPrint-WorkLog
 *
 * Author: Alexander Shvetsov <shv-box@mail.com> based on FilamentManager by Sven Lohrmann <malnvenshorn@gmail.com>
 *
 * License: AGPLv3
 */

const WorkLog = function WorkLog() {
    this.core.common.call(this);
    this.core.client.call(this);
    return this.core.bridge.call(this);
};

WorkLog.prototype = {
    constructor: WorkLog,
    core: {},
    viewModels: {},
};
