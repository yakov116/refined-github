import './jump-to-bottom-link.css';
import React from 'dom-chef';
import select from 'select-dom';
import features from '../libs/features';
import observeEl from '../libs/simplified-element-observer';

function add(): void | false {
	const meta = select('.gh-header-meta > .TableObject-item--primary');
	if (!meta || select.exists('#rgh-jump-to-bottom-link')) {
		return;
	}

	meta.append(
		' · ',
		<a href="#partial-timeline" id="rgh-jump-to-bottom-link">Jump to bottom</a>
	);
}

function init(): void | false {
	// The issue header changes when new comments are added or the issue status changes
	observeEl('.js-issues-results', add);
}

features.add({
	id: __featureName__,
	description: 'Jump To Bottom',
	include: [
		features.isIssue,
		features.isPRConversation
	],
	load: features.onAjaxedPages,
	init
});
