/* eslint-disable no-unused-vars */
/* eslint-disable max-len */
/* eslint-disable capitalized-comments */
const URL = require('url');
const UTIL = require('./util');
const QS = require('querystring');

const main = module.exports = (searchPageResponse, options, callback) => { // eslint-disable-line consistent-return
  // Check wether options wether no options were provided
  if (typeof options === 'function') {
    callback = options;
    options = { limit: 100 };
  }
  // Return a promise when no callback is provided
  if (!callback) {
    return new Promise((resolve, reject) => {
      main(searchPageResponse, options, (err, info) => { // eslint-disable-line consistent-return
        if (err) return reject(err);
        resolve(info);
      });
    });
  }
  if (!options) options = { limit: 100 };
  // if (!searchString && !options.nextpageRef) return callback(new Error('search string or nextpageRef is mandatory'));
  if (isNaN(options.limit)) options.limit = 100;

  // Save provided nextpageRef and do the request
  const currentRef = options.nextpageRef;
  // UTIL.getPage(currentRef ? UTIL.buildFromNextpage(currentRef) : UTIL.buildLink(searchString), (err, body) => { // eslint-disable-line consistent-return, max-len
  let body = searchPageResponse;

  let content;
  try {
    const parsed = JSON.parse(body);
    content = parsed[parsed.length - 1].body.content;
  } catch (e) {
    return callback(e);
  }

  // Get the table of items and parse it(remove null items where the parsing failed)
  const items = UTIL
    .between(content, '<ol id="item-section-', '\n</ol>')
    .split('</li>\n\n<li>')
    .filter(t => {
      let condition1 = !t.includes('<div class="pyv-afc-ads-container" style="visibility:visible">');
      let condition2 = !t.includes('<span class="spell-correction-corrected">');
      let condition3 = !t.includes('<div class="search-message">');
      let condition4 = !t.includes('<li class="search-exploratory-line">');
      return condition1 && condition2 && condition3 && condition4;
    })
    .map(t => UTIL.parseItem(t, body, ''))
    .filter(a => a)
    .filter((item, index) => !isNaN(options.limit) ? index < options.limit : true);
  if (!isNaN(options.limit)) options.limit -= items.length;

  // Get amount of results
  const results = UTIL.between(UTIL.between(content, '<p class="num-results', '</p>'), '>') || 0;

  // Get informations about set filters
  const filters = UTIL.parseFilters(content);
  const activeFilters = Array.from(filters).map(a => a[1].active).filter(a => a);

  const pagesContainer = UTIL
    .between(content, '<div class="branded-page-box search-pager  spf-link ">', '</div>')
    .split('<a');
  const lastPageRef = pagesContainer[pagesContainer.length - 1];
  const nextpageRef = UTIL.removeHtml(UTIL.between(lastPageRef, 'href="', '"')) || null;

  // Were already on last page or hit the limit
  if (lastPageRef.includes('data-redirect-url="/results?') ||
    (!isNaN(options.limit) && options.limit < 1) ||
    !nextpageRef) {
    return callback(null, {
      query: QS.unescape(URL.parse(currentRef, true).query.search_query),
      items,
      nextpageRef,
      results,
      filters: activeFilters,
      currentRef: currentRef || null,
    });
  }

  options.nextpageRef = nextpageRef;
  main(searchPageResponse, options, (e, data) => { // eslint-disable-line consistent-return, max-len
    if (e) return callback(e);
    items.push(...data.items);
    callback(null, {
      query: QS.unescape(URL.parse(currentRef, true).query.search_query),
      items,
      nextpageRef: data.nextpageRef,
      results,
      filters: activeFilters,
      currentRef: data.currentRef,
    });
  });
};

const getFilters = main.getFilters = (pageResponse, callback) => { // eslint-disable-line consistent-return
  // Return a promise when no callback is provided
  if (!callback) {
    return new Promise((resolve, reject) => {
      getFilters(pageResponse, (err, info) => { // eslint-disable-line consistent-return
        if (err) return reject(err);
        resolve(info);
      });
    });
  }

  let content;
  try {
    const parsed = JSON.parse(pageResponse);
    content = parsed[parsed.length - 1].body.content;
    callback(null, UTIL.parseFilters(content)); // eslint-disable-line callback-return
  } catch (e) {
    return callback(e);
  }
};

const getRefSearchURL = main.getRefSearchURL = currentRef => // eslint-disable-line consistent-return
  UTIL.buildFromNextpage(currentRef);

const getFiltersQueryString = main.getFiltersQueryString = searchString => {
  if (!searchString) return new Error('search string is mandatory');

  let queryString;
  let parsedQuery = URL.parse(searchString, true);
  if (parsedQuery.query.sp && parsedQuery.query.search_query) queryString = UTIL.buildFromNextpage(searchString);
  else queryString = UTIL.buildLink(searchString);

  return queryString;
};
