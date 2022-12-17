import fs from 'fs/promises';
import path from 'path';
import he from 'he';
import { html } from '../util/html.mjs';
import { NPM_DATA_MAINTAINED_PLUGINS_FILE_PATH, PAGES_INDEX_HTML_FILE_PATH } from '../constants.mjs';
import { normalizeKeyword } from '../../config/normalize-keywords.mjs';
import { excludedKeywords } from '../../config/excluded-keywords.mjs';
import { traverseDir } from '../util/traverse-dir.mjs';
import { renderPage } from './render-page.mjs';
import { renderKeywords } from './render-keywords.mjs';
import { renderFunding } from './render-funding.mjs';
import { renderScope } from './render-scope.mjs';
import { renderPlugin } from './render-plugin.mjs';

export async function pages() {
	const maintainedPluginsRawData = await fs.readFile(NPM_DATA_MAINTAINED_PLUGINS_FILE_PATH);

	{
		const pluginDataFiles = await traverseDir('./directory');
		const pluginsSet = new Set(JSON.parse(maintainedPluginsRawData).objects.map((plugin) => {
			return path.join('directory', plugin.package.name) + '.json';
		}));

		for (let i = 0; i < pluginDataFiles.length; i++) {
			const pluginDataFile = pluginDataFiles[i];
			if (!pluginsSet.has(pluginDataFile)) {
				await fs.rm(pluginDataFile);
			}
		}
	}

	const pluginDataFiles = await traverseDir('./directory');

	let result = '';
	let searchData = [];
	const allKeywords = new Set();

	const maintainedPluginsData = new Map(JSON.parse(maintainedPluginsRawData).objects.map((plugin) => {
		return [plugin.package.name, plugin];
	}));

	const allPluginData = [];
	for (let i = 0; i < pluginDataFiles.length; i++) {
		const pluginDataFile = pluginDataFiles[i];
		const pluginData = JSON.parse(await fs.readFile(pluginDataFile));
		pluginData.scope = maintainedPluginsData.get(pluginData.name).package.scope;
		pluginData.unscopedPackageName = unscopedPackageName(pluginData);
		pluginData.repository = maintainedPluginsData.get(pluginData.name).package.links?.repository;
		allPluginData.push(pluginData);
	}

	function unscopedPackageName(pluginData) {
		if (!pluginData.scope || pluginData.scope === 'unscoped') {
			return pluginData.name;
		}

		return pluginData.name.slice(`@${pluginData.scope}/`.length);
	}

	allPluginData.sort((a, b) => {
		if (a.unscopedPackageName !== b.unscopedPackageName) {
			return a.unscopedPackageName.localeCompare(b.unscopedPackageName);
		}

		if (a.scope === 'unscoped') {
			return -1;
		} else if (b.scope === 'unscoped') {
			return 1;
		} else {
			return a.name.localeCompare(b.name);
		}
	})

	for (let i = 0; i < allPluginData.length; i++) {
		const pluginData = allPluginData[i];

		pluginData.keywords = (pluginData.keywords?.length ? pluginData.keywords : []).map((x) => {
			return normalizeKeyword(x.toLowerCase().trim());
		}).filter((x) => {
			return !excludedKeywords.has(x);
		});

		if (pluginData.repository && pluginData.repository.startsWith('https://github.com/csstools/')) {
			pluginData.keywords.push('csstools');
		}

		if (pluginData.repository && pluginData.repository.startsWith('https://github.com/cssnano/')) {
			pluginData.keywords.push('cssnano');
		}

		pluginData.keywords = Array.from(new Set(pluginData.keywords));

		searchData.push({
			name: pluginData.name,
			id: he.encode(encodeURIComponent(pluginData.name)),
			keywords: pluginData.keywords,
			description: pluginData.description ?? ''
		});

		for (let j = 0; j < pluginData.keywords.length; j++) {
			allKeywords.add(pluginData.keywords[j]);
		}

		result += renderPlugin(pluginData);
	}

	const allKeywordsSorted = Array.from(allKeywords);
	allKeywordsSorted.sort((a, b) => a.localeCompare(b));

	await fs.writeFile(PAGES_INDEX_HTML_FILE_PATH, renderPage(result, searchData, allKeywordsSorted));
}
