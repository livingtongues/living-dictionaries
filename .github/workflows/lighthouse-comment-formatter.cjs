// @ts-check

/**
 * @typedef {Object} LighthouseOutputs
 * @prop {Record<string, string>} links
 * @prop {Manifest[]} manifest
 */

/**
 * @typedef {Object} Manifest
 * @prop {string} url
 * @prop {boolean} isRepresentativeRun
 * @prop {string} htmlPath
 * @prop {string} jsonPath
 * @prop {Summary} summary
 */

/**
 * @typedef {Object} Summary
 * @prop {number} performance
 * @prop {number} accessibility
 * @prop {number} best-practices
 * @prop {number} seo
 * @prop {number} pwa
 */

const formatScore = (/** @type { number } */ score) => Math.round(score * 100);
const emojiScore = (/** @type { number } */ score) =>
  score >= 0.9 ? '🟢' : score >= 0.5 ? '🟠' : '🔴';

const scoreRow = (
  /** @type { string } */ label,
  /** @type { number } */ score
) => `| ${emojiScore(score)} ${label} | ${formatScore(score)} |`;

const scoreSimple = (
  /** @type { string } */ label,
  /** @type { number } */ score
) => `${label} ${emojiScore(score)} ${formatScore(score)}`;

/**
 * @param {LighthouseOutputs} lighthouseOutputs
 * @param {'slack' | 'pr'} targetPlatform
 */
function makeComment(lighthouseOutputs, targetPlatform) {
  let comment = `## ⚡️Lighthouse report`;

  for (const manifest of lighthouseOutputs.manifest) {
    const { url: testedUrl, summary } = manifest;
    const reportUrl = lighthouseOutputs.links[testedUrl];
    
    if (targetPlatform === 'slack') {
      // eslint-disable-next-line no-undef
      comment += ` | Results for ${new URL(testedUrl).pathname}: ${scoreSimple('Performance', summary.performance)}, ${scoreSimple('Accessibility', summary.accessibility)}, ${scoreSimple('Best practices', summary['best-practices'])}, ${scoreSimple('SEO', summary.seo)}, ${scoreSimple('PWA', summary.pwa)}, ${reportUrl}`;
    }

    if (targetPlatform === 'pr') {
      comment += `
Results for [${testedUrl}](${testedUrl}) (see [detailed report](${reportUrl}))

| Category | Score |
| -------- | ----- |
${scoreRow('Performance', summary.performance)}
${scoreRow('Accessibility', summary.accessibility)}
${scoreRow('Best practices', summary['best-practices'])}
${scoreRow('SEO', summary.seo)}
${scoreRow('PWA', summary.pwa)}
`;
    }
  }

  return comment;
}

module.exports = ({ lighthouseOutputs, targetPlatform }) => {
  return makeComment(lighthouseOutputs, targetPlatform);
};

// from https://blog.logrocket.com/lighthouse-meets-github-actions-use-lighthouse-ci/