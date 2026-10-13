import i18n from '@i18n/config';
import { ActionId } from '@sim/proto/action_id';
import { SimError } from '@sim/sim';
import { toastManager } from '@ui-kit/Toast';

import type { CrashReportOpener } from './crash_report_opener';

export interface CrashReportContext {
	crashReport: CrashReportOpener;
	toLink: () => string;
	getLastUsedRngSeed: () => number;
}

export async function reportSimCrash(error: any, ctx: CrashReportContext): Promise<void> {
	if (!(error instanceof SimError)) {
		if (error.message) {
			toastManager.add({
				variant: 'error',
				body: error.message,
			});
		} else {
			alert(error);
		}
		return;
	}

	toastManager.add({
		variant: 'error',
		body: i18n.t('sim.notifications.simulation_failed'),
	});

	const errorStr = (error as SimError).errorStr;
	if (errorStr.startsWith('[USER_ERROR] ')) {
		let alertStr = errorStr.substring('[USER_ERROR] '.length);
		alertStr = await ActionId.replaceAllInString(alertStr);
		alert(alertStr);
		return;
	}

	if (window.confirm(i18n.t('sim.crash_report.confirm_title') + '\n' + errorStr + '\n' + i18n.t('sim.crash_report.confirm_message'))) {
		// Nothing is sent anywhere: the details open in a dialog to copy from.
		ctx.crashReport.open(`Link:\n${ctx.toLink()}\n\nRNG Seed: ${ctx.getLastUsedRngSeed()}\n\n${errorStr}`);
	}
}
