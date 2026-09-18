#!/usr/bin/env node
// Config-driven page/image downloader for comic and magazine sites: a site
// profile (sites/<name>/download.config.json, next to this scripts/ folder)
// describes URL templates, item/issue ranges, page ranges and output folders;
// this script expands them into download jobs and fetches them with axios
// (comic-downloader/node_modules, from this skill's package.json).
//
// Usage: node comic-downloader/scripts/download.cjs [--site <name> | --config <path>] [--dry-run] [--overwrite]
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pipeline } = require('stream/promises');

const SITES_DIR = path.join(__dirname, '..', 'sites');   // <skill>/sites/<name>/download.config.json
const DEFAULT_CONFIG_PATH = path.join(SITES_DIR, 'dorothee', 'download.config.json');
const DEFAULT_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
let axiosClient;

function getAxios() {
  if (!axiosClient) {
    axiosClient = require('axios');
  }

  return axiosClient;
}

function printUsage() {
  console.log(`
Usage:
  node comic-downloader/scripts/download.cjs --site dorothee
  node comic-downloader/scripts/download.cjs --config comic-downloader/sites/example/download.config.json

Options:
  -s, --site <name>    Use sites/<name>/download.config.json.
  -c, --config <path>  Use a different JSON config file.
  --dry-run           Print the URLs and output paths without downloading.
  --overwrite         Replace files that already exist.
  -h, --help          Show this help message.

Default config:
  comic-downloader/sites/dorothee/download.config.json
`);
}

function getSiteConfigPath(siteName) {
  return path.join(SITES_DIR, siteName, 'download.config.json');
}

function parseArgs(argv) {
  const options = {
    configPath: DEFAULT_CONFIG_PATH,
    dryRun: false,
    overwrite: false,
    help: false
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--overwrite') {
      options.overwrite = true;
    } else if (arg === '-h' || arg === '--help') {
      options.help = true;
    } else if (arg === '-s' || arg === '--site') {
      index += 1;
      if (!argv[index]) {
        throw new Error(`${arg} requires a site name.`);
      }
      options.configPath = getSiteConfigPath(argv[index]);
    } else if (arg.startsWith('--site=')) {
      options.configPath = getSiteConfigPath(arg.slice('--site='.length));
    } else if (arg === '-c' || arg === '--config') {
      index += 1;
      if (!argv[index]) {
        throw new Error(`${arg} requires a file path.`);
      }
      options.configPath = path.resolve(process.cwd(), argv[index]);
    } else if (arg.startsWith('--config=')) {
      options.configPath = path.resolve(process.cwd(), arg.slice('--config='.length));
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function readConfig(configPath) {
  const rawConfig = fs.readFileSync(configPath, 'utf8');
  return JSON.parse(rawConfig);
}

function pad(value, size) {
  const width = Number.parseInt(size ?? 0, 10);

  if (!width || width <= 0) {
    return String(value);
  }

  return String(value).padStart(width, '0');
}

function getMonthNames(config) {
  return config.monthNames ?? DEFAULT_MONTHS;
}

function parseDateParts(dateStr, config = {}) {
  const [year, month, day] = String(dateStr).split('-');
  const monthIndex = Number.parseInt(month, 10) - 1;

  if (!year || Number.isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    throw new Error(`Invalid date "${dateStr}". Use YYYY-MM or YYYY-MM-DD.`);
  }

  const monthName = getMonthNames(config)[monthIndex] ?? month;

  return {
    year,
    month,
    day,
    monthName
  };
}

function formatDateLabel(dateStr, config) {
  const { year, monthName, day } = parseDateParts(dateStr, config);
  return `${day ? `${Number.parseInt(day, 10)} ` : ''}${monthName} ${year}`;
}

function addMonths(dateStr, count, config) {
  const { year, month } = parseDateParts(dateStr, config);
  const totalMonths = Number.parseInt(year, 10) * 12 + Number.parseInt(month, 10) - 1 + count;
  const nextYear = Math.floor(totalMonths / 12);
  const nextMonth = (totalMonths % 12) + 1;

  return `${nextYear}-${pad(nextMonth, 2)}`;
}

function compareMonthDates(leftDate, rightDate, config) {
  const left = parseDateParts(leftDate, config);
  const right = parseDateParts(rightDate, config);
  const leftValue = Number.parseInt(left.year, 10) * 12 + Number.parseInt(left.month, 10);
  const rightValue = Number.parseInt(right.year, 10) * 12 + Number.parseInt(right.month, 10);

  return leftValue - rightValue;
}

function pickFirstValue(source, keys) {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null && source[key] !== '') {
      return source[key];
    }
  }

  return undefined;
}

function normalizeItem(item) {
  if (Array.isArray(item)) {
    return {
      item: String(item[0]),
      itemId: String(item[0]),
      itemNumber: String(item[0]),
      issue: String(item[0]),
      issueNumber: String(item[0]),
      date: item[1]
    };
  }

  if (typeof item !== 'object' || item === null) {
    return {
      item: String(item),
      itemId: String(item),
      itemNumber: String(item)
    };
  }

  const normalized = {
    ...(item.variables ?? {}),
    ...item
  };
  const itemId = pickFirstValue(normalized, ['item', 'itemId', 'id', 'slug', 'number', 'issue', 'issueNumber', 'name']);
  const itemNumber = pickFirstValue(normalized, ['itemNumber', 'number', 'issueNumber', 'issue', 'item', 'id']);
  const issueNumber = pickFirstValue(normalized, ['issueNumber', 'issue', 'number', 'itemNumber', 'item', 'id']);

  if (itemId !== undefined) {
    normalized.item = String(itemId);
    normalized.itemId = String(itemId);
  }

  if (itemNumber !== undefined) {
    normalized.itemNumber = String(itemNumber);
  }

  if (issueNumber !== undefined) {
    normalized.issue = String(issueNumber);
    normalized.issueNumber = String(issueNumber);
  }

  if (normalized.date !== undefined && normalized.date !== null) {
    normalized.date = String(normalized.date);
  }

  return normalized;
}

function expandNumberedRange(range, config, aliases = {}) {
  const startNumber = Number.parseInt(range.startItem ?? range.startNumber ?? range.startIssue, 10);
  const endNumberValue = range.endItem ?? range.endNumber ?? range.endIssue;
  const endNumber = endNumberValue === undefined ? undefined : Number.parseInt(endNumberValue, 10);
  const step = Number.parseInt(range.step ?? 1, 10);
  const dateStepMonths = Number.parseInt(range.dateStepMonths ?? 1, 10);

  if (Number.isNaN(startNumber)) {
    throw new Error('Item ranges require startItem, startNumber, or startIssue.');
  }

  if (Number.isNaN(step) || step <= 0) {
    throw new Error('Item ranges require a positive step value.');
  }

  if (range.startDate === undefined && range.endDate !== undefined) {
    throw new Error('Item ranges with endDate also require startDate.');
  }

  if (endNumber === undefined && !range.endDate && !range.count) {
    throw new Error('Item ranges require endItem/endNumber/endIssue, endDate, or count.');
  }

  const items = [];
  let currentNumber = startNumber;
  let currentDate = range.startDate;

  while (true) {
    const rangeItem = normalizeItem({
      ...(range.variables ?? {}),
      item: String(currentNumber),
      itemNumber: String(currentNumber),
      number: String(currentNumber),
      date: currentDate
    });

    if (aliases.issue) {
      rangeItem.issue = String(currentNumber);
      rangeItem.issueNumber = String(currentNumber);
    }

    items.push(rangeItem);

    const reachedNumber = endNumber === undefined || currentNumber === endNumber;
    const reachedDate = !range.endDate || currentDate === range.endDate;
    const reachedCount = !range.count || items.length >= range.count;

    if (reachedNumber && reachedDate && reachedCount) {
      break;
    }

    currentNumber += step;

    if (currentDate) {
      currentDate = addMonths(currentDate, dateStepMonths, config);
    }

    if (endNumber !== undefined && currentNumber > endNumber) {
      throw new Error(`Item range passed end number ${endNumber} before reaching its endDate/count.`);
    }

    if (range.endDate && compareMonthDates(currentDate, range.endDate, config) > 0) {
      throw new Error(`Item range passed endDate ${range.endDate} before reaching its end number/count.`);
    }
  }

  return items;
}

function getConfiguredItems(config) {
  return [
    ...(config.itemRanges ?? []).flatMap((range) => expandNumberedRange(range, config)),
    ...(config.issueRanges ?? []).flatMap((range) => expandNumberedRange(range, config, { issue: true })),
    ...(config.items ?? []).map(normalizeItem),
    ...(config.issues ?? []).map((issue) => {
      const normalized = normalizeItem(issue);

      if (!normalized.issue && normalized.item) {
        normalized.issue = normalized.item;
        normalized.issueNumber = normalized.item;
      }

      return normalized;
    })
  ];
}

function getItems(config) {
  const items = getConfiguredItems(config);

  if (items.length === 0) {
    return {
      hasConfiguredItems: false,
      items: [normalizeItem({ item: '', itemId: '' })]
    };
  }

  return {
    hasConfiguredItems: true,
    items
  };
}

function getPages(downloadConfig) {
  const pages = downloadConfig.pages;

  if (pages === undefined || pages === null) {
    return [undefined];
  }

  if (Array.isArray(pages)) {
    return pages;
  }

  if (typeof pages === 'number' || typeof pages === 'string') {
    return [pages];
  }

  const from = Number.parseInt(pages.from, 10);
  const to = Number.parseInt(pages.to, 10);
  const step = Number.parseInt(pages.step ?? 1, 10);

  if (Number.isNaN(from) || Number.isNaN(to) || Number.isNaN(step) || step <= 0) {
    throw new Error(`Invalid pages value for "${downloadConfig.name ?? 'download'}".`);
  }

  const values = [];
  for (let page = from; page <= to; page += step) {
    values.push(page);
  }

  return values;
}

function normalizePageTarget(page, index) {
  if (typeof page === 'object' && page !== null) {
    return {
      targetIndex: index + 1,
      ...page,
      page: page.page ?? page.number ?? index + 1
    };
  }

  return {
    targetIndex: index + 1,
    page
  };
}

function normalizeUrlTarget(urlEntry, index) {
  if (typeof urlEntry === 'string') {
    return {
      targetIndex: index + 1,
      url: urlEntry
    };
  }

  if (typeof urlEntry !== 'object' || urlEntry === null) {
    throw new Error('Download urls entries must be strings or objects.');
  }

  return {
    targetIndex: index + 1,
    ...urlEntry
  };
}

function getDownloadTargets(downloadConfig) {
  if (downloadConfig.urls !== undefined) {
    if (!Array.isArray(downloadConfig.urls)) {
      throw new Error(`Download urls for "${downloadConfig.name ?? 'download'}" must be an array.`);
    }

    return downloadConfig.urls.map(normalizeUrlTarget);
  }

  return getPages(downloadConfig).map(normalizePageTarget);
}

function renderTemplate(template, values) {
  return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
    if (values[key] === undefined || values[key] === null) {
      throw new Error(`Missing template value for ${match}.`);
    }

    return String(values[key]);
  });
}

function isAbsoluteUrl(value) {
  return /^https?:\/\//i.test(String(value));
}

function joinUrl(baseUrl, urlPath) {
  if (isAbsoluteUrl(urlPath)) {
    return String(urlPath);
  }

  if (!baseUrl) {
    throw new Error('Config must include baseUrl when downloads use urlPathTemplate.');
  }

  if (!urlPath) {
    throw new Error('Download target must include urlTemplate, urls, or urlPathTemplate.');
  }

  return `${String(baseUrl).replace(/\/+$/, '')}/${String(urlPath).replace(/^\/+/, '')}`;
}

function getFileName(urlPath, url) {
  const fromPath = String(urlPath ?? '').split(/[?#]/)[0];

  if (fromPath) {
    const fileName = path.basename(fromPath);

    if (fileName) {
      return decodeURIComponent(fileName);
    }
  }

  try {
    const fileName = path.basename(new URL(url).pathname);

    if (fileName) {
      return decodeURIComponent(fileName);
    }
  } catch (error) {
    throw new Error(`Could not infer a file name for ${url}. Add fileNameTemplate.`);
  }

  throw new Error(`Could not infer a file name for ${url}. Add fileNameTemplate.`);
}

function getItemContext(item, config) {
  const context = {
    ...(config.variables ?? {}),
    ...item,
    siteName: config.siteName ?? config.name ?? '',
    baseUrl: config.baseUrl ?? ''
  };
  const itemNumberPadding = config.itemNumberPadding ?? config.issueNumberPadding ?? 0;
  const issueNumberPadding = config.issueNumberPadding ?? config.itemNumberPadding ?? 0;

  context.item = context.item ?? '';
  context.itemId = context.itemId ?? context.item;
  context.itemNumber = context.itemNumber ?? context.item;
  context.issue = context.issue ?? context.item;
  context.issueNumber = context.issueNumber ?? context.issue;
  context.itemPadded = context.itemNumber === '' ? '' : pad(context.itemNumber, itemNumberPadding);
  context.issuePadded = context.issueNumber === '' ? '' : pad(context.issueNumber, issueNumberPadding);

  if (context.date) {
    const { year, month, day, monthName } = parseDateParts(context.date, config);

    context.year = year;
    context.month = month;
    context.day = day ?? '';
    context.monthName = monthName;
    context.dateLabel = formatDateLabel(context.date, config);
  } else {
    context.date = '';
    context.year = '';
    context.month = '';
    context.day = '';
    context.monthName = '';
    context.dateLabel = '';
  }

  return context;
}

// Downloads land in ~/Downloads ($COMIC_OUTPUT_DIR overrides that root):
//   no "outputDir"            -> <root>/<profile folder name>
//   "outputDir": "my-site"    -> <root>/my-site       (relative = under the root)
//   "outputDir": "~/x", "/x"  -> exactly there
function resolveOutputRoot(config, configPath) {
  const root = process.env.COMIC_OUTPUT_DIR || path.join(os.homedir(), 'Downloads');
  const dir = config.outputDir ?? path.basename(path.dirname(configPath));
  if (dir === '~' || dir.startsWith('~/')) {
    return path.join(os.homedir(), dir.slice(2));
  }
  return path.resolve(root, dir);
}

function buildJobs(config, configPath) {
  const { items, hasConfiguredItems } = getItems(config);
  const downloads = config.downloads ?? [];
  const outputRoot = resolveOutputRoot(config, configPath);
  const itemFolderTemplate = config.itemFolderTemplate
    ?? config.collectionFolderTemplate
    ?? config.issueFolderTemplate
    ?? (hasConfiguredItems ? '{item}' : '');

  if (downloads.length === 0) {
    throw new Error('Config must include at least one download target.');
  }

  return items.flatMap((item) => {
    const itemContext = getItemContext(item, config);
    const itemFolder = itemFolderTemplate
      ? path.join(outputRoot, renderTemplate(itemFolderTemplate, itemContext))
      : outputRoot;

    return downloads.flatMap((downloadConfig) => {
      return getDownloadTargets(downloadConfig).map((target) => {
        const pageNumberPadding = target.pageNumberPadding
          ?? downloadConfig.pageNumberPadding
          ?? config.pageNumberPadding
          ?? 0;
        const targetPage = target.page ?? '';
        const values = {
          ...itemContext,
          ...(downloadConfig.variables ?? {}),
          ...target,
          downloadName: downloadConfig.name ?? '',
          page: targetPage,
          pagePadded: targetPage === '' ? '' : pad(targetPage, pageNumberPadding)
        };
        const urlPathTemplate = target.urlPathTemplate
          ?? downloadConfig.urlPathTemplate
          ?? downloadConfig.pathTemplate;
        const urlPath = target.urlPath
          ?? (urlPathTemplate ? renderTemplate(urlPathTemplate, values) : '');
        const urlValues = { ...values, urlPath };
        const explicitUrl = target.url ?? downloadConfig.url;
        const url = explicitUrl
          ? renderTemplate(explicitUrl, urlValues)
          : downloadConfig.urlTemplate
            ? renderTemplate(downloadConfig.urlTemplate, urlValues)
            : joinUrl(config.baseUrl, urlPath);
        const outputValues = { ...urlValues, url };
        const outputSubdirTemplate = target.outputSubdirTemplate ?? downloadConfig.outputSubdirTemplate;
        const outputSubdir = outputSubdirTemplate ? renderTemplate(outputSubdirTemplate, outputValues) : '';
        const fileNameValue = target.fileName
          ?? target.fileNameTemplate
          ?? downloadConfig.fileName
          ?? downloadConfig.fileNameTemplate;
        const fileName = fileNameValue
          ? renderTemplate(fileNameValue, outputValues)
          : getFileName(urlPath, url);

        return {
          url,
          outputPath: path.join(itemFolder, outputSubdir, fileName)
        };
      });
    });
  });
}

async function downloadFile(job, options) {
  if (options.dryRun) {
    console.log(`[dry-run] ${job.url} -> ${job.outputPath}`);
    return 'dry-run';
  }

  if (!options.overwriteExisting && fs.existsSync(job.outputPath)) {
    console.log(`Skipped existing: ${job.outputPath}`);
    return 'skipped';
  }

  fs.mkdirSync(path.dirname(job.outputPath), { recursive: true });

  const response = await getAxios().get(job.url, {
    responseType: 'stream',
    timeout: options.timeoutMs ?? 30000
  });

  await pipeline(response.data, fs.createWriteStream(job.outputPath));
  console.log(`Saved: ${job.url}`);
  return 'saved';
}

async function main() {
  const cliOptions = parseArgs(process.argv);

  if (cliOptions.help) {
    printUsage();
    return;
  }

  const config = readConfig(cliOptions.configPath);
  const jobs = buildJobs(config, cliOptions.configPath);
  const overwriteExisting = cliOptions.overwrite || Boolean(config.overwriteExisting);
  const timeoutMs = config.request?.timeoutMs;
  const totals = {
    saved: 0,
    skipped: 0,
    failed: 0,
    dryRun: 0
  };

  console.log(`Loaded ${jobs.length} download target(s) from ${cliOptions.configPath}.`);

  for (const job of jobs) {
    try {
      const result = await downloadFile(job, {
        dryRun: cliOptions.dryRun,
        overwriteExisting,
        timeoutMs
      });

      if (result === 'dry-run') {
        totals.dryRun += 1;
      } else {
        totals[result] += 1;
      }
    } catch (error) {
      totals.failed += 1;
      console.error(`Failed: ${job.url} - ${error.message}`);
    }
  }

  console.log(
    `Done. Saved: ${totals.saved}. Skipped: ${totals.skipped}. Failed: ${totals.failed}. Dry run: ${totals.dryRun}.`
  );

  if (totals.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
