import React from 'dom-chef';
import select from 'select-dom';
import cache from 'webext-storage-cache';
import MergeIcon from 'octicon/git-merge.svg';
import PullRequestIcon from 'octicon/git-pull-request.svg';
import * as api from '../libs/api';
import features from '../libs/features';
import * as pageDetect from '../libs/page-detect';
import {getRepoURL, getRepoGQL} from '../libs/utils';
import observeElement from '../libs/simplified-element-observer';

interface PullRequest {
	number: number;
	state: string;
	isDraft: boolean;
	url: string;
}

const getPullRequestsAssociatedWithBranch = cache.function(async (): Promise<Record<string, PullRequest>> => {
	const {repository} = await api.v4(`
		repository(${getRepoGQL()}) {
			databaseId
			refs(refPrefix: "refs/heads/", last: 100) {
				nodes {
					name
					associatedPullRequests(last: 1, orderBy: {field: CREATED_AT, direction: DESC}) {
						nodes {
							number
							state
							isDraft
							url
							timelineItems(last: 1, itemTypes: [HEAD_REF_DELETED_EVENT, HEAD_REF_RESTORED_EVENT]) {
								nodes {
									__typename
								}
							}
							baseRepository {
								databaseId
							}
						}
					}
				}
			}
		}
	`);

	const pullRequests = {};
	for (const {name, associatedPullRequests} of repository.refs.nodes) {
		const [prInfo] = associatedPullRequests.nodes;
		// Check if the ref was deleted, since the result includes pr's that are not in fact related to this branch but rather to the branch name.
		const headRefWasDeleted = prInfo?.timelineItems.nodes[0]?.__typename === 'HeadRefDeletedEvent';
		// Local PR's github will put the association
		const localPR = repository.databaseId === prInfo?.baseRepository.databaseId;
		if (prInfo && !headRefWasDeleted && !localPR) {
			prInfo.state = prInfo.isDraft && prInfo.state === 'OPEN' ? 'Draft' : upperCaseFirst(prInfo.state);
			(pullRequests as AnyObject)[name] = prInfo;
		}
	}

	return pullRequests;
}, {
	maxAge: 1 / 2,
	staleWhileRevalidate: 4,
	cacheKey: () => 'associatedBranchPullRequests:' + getRepoURL()
});

// https://github.com/idimetrix/text-case/blob/master/packages/upper-case-first/src/index.ts
function upperCaseFirst(input: string): string {
	return input.charAt(0).toUpperCase() + input.slice(1).toLowerCase();
}

const stateClass: Record<string, string> = {
	Open: '--green',
	Closed: '--red',
	Merged: '--purple',
	Draft: ''
};

async function init(): Promise<void> {
	const associatedPullRequests = await getPullRequestsAssociatedWithBranch();

	for (const branch of select.all('[branch]')) {
		const prInfo = associatedPullRequests[branch.getAttribute('branch')!];
		if (prInfo) {
			const StateIcon = prInfo.state === 'Merged' ? MergeIcon : PullRequestIcon;

			select('.test-compare-link', branch)!.replaceWith(
				<div className="d-inline-block text-right ml-3">
					<a
						data-issue-and-pr-hovercards-enabled
						href={prInfo.url}
						className="muted-link"
						data-hovercard-type="pull_request"
						data-hovercard-url={prInfo.url + '/hovercard'}
					>
						#{prInfo.number}
					</a>
					<a
						className={`State State${stateClass[prInfo.state]} State--small ml-1 no-underline`}
						title={`Status: ${prInfo.state}`}
						href={prInfo.url}
					>
						<StateIcon width={10} height={14}/> {prInfo.state}
					</a>
				</div>);
		}
	}
}

features.add({
	id: __filebasename,
	description: 'Shows the associated pull requests on branches for forked repository’s',
	screenshot: 'https://user-images.githubusercontent.com/16872793/79875403-9d53f380-83b7-11ea-8dc9-62ef9d3a3ca1.png'
}, {
	include: [
		pageDetect.isBranches
	],
	exclude: [
		() => !pageDetect.isForkedRepo()
	],
	init: () => {
		observeElement('[data-target="branch-filter-controller.results"]', init);
	}
});
