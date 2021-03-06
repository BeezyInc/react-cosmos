import path from 'path';
import fs from 'fs-extra';
import { silent as silentImport } from 'import-from';
import getLoaderWebpackConfig from './loader-webpack-config';
import getDefaultWebpackConfig from './default-webpack-config';
import importModule from 'react-cosmos-utils/lib/import-module';
import getCosmosConfig from 'react-cosmos-config';

const moduleExists = modulePath => {
  try {
    return modulePath && require.resolve(modulePath) && true;
  } catch (err) {
    return false;
  }
};

const exportPlaygroundFiles = outputPath => {
  fs.copySync(
    path.join(__dirname, 'static/favicon.ico'),
    `${outputPath}/favicon.ico`
  );

  fs.copySync(
    require.resolve('react-cosmos-component-playground'),
    `${outputPath}/bundle.js`
  );

  const playgroundHtml = fs.readFileSync(
    path.join(__dirname, 'static/index.html'),
    'utf8'
  );
  const playgroundOpts = JSON.stringify({
    loaderUri: './loader/index.html'
  });
  fs.writeFileSync(
    `${outputPath}/index.html`,
    playgroundHtml.replace('__PLAYGROUND_OPTS__', playgroundOpts)
  );
};

const runWebpackCompiler = (webpack, config) =>
  new Promise((resolve, reject) => {
    const compiler = webpack(config);
    compiler.run((err, stats) => {
      if (err) {
        reject(err);
      } else {
        resolve(stats);
      }
    });
  });

module.exports = function startExport(cosmosConfigPath) {
  const cosmosConfig = getCosmosConfig(cosmosConfigPath);
  const { webpackConfigPath, outputPath, publicPath, publicUrl } = cosmosConfig;

  const webpack = silentImport(cosmosConfigPath, 'webpack');
  if (!webpack) {
    console.warn('[Cosmos] webpack dependency missing!');
    console.log('Install using "yarn add webpack" or "npm install webpack"');
    return;
  }

  let userWebpackConfig;
  if (moduleExists(webpackConfigPath)) {
    console.log(`[Cosmos] Using webpack config found at ${webpackConfigPath}`);
    userWebpackConfig = importModule(require(webpackConfigPath));
  } else {
    console.log('[Cosmos] No webpack config found, using default config');
    userWebpackConfig = getDefaultWebpackConfig(cosmosConfigPath);
  }

  const loaderWebpackConfig = getLoaderWebpackConfig({
    webpack,
    userWebpackConfig,
    cosmosConfigPath,
    shouldExport: true
  });

  // Copy static files first, so that the built index.html overrides the its
  // template file (in case the static assets are served from the root path)
  if (publicPath) {
    if (outputPath.indexOf(publicPath) === -1) {
      const exportPublicPath = path.join(outputPath, publicUrl);
      fs.copySync(publicPath, exportPublicPath);
    } else {
      console.warn(
        `[Cosmos] Warning: Can't export public path because it contains the export path! (avoiding infinite loop)`
      );
      console.warn('Public path:', publicPath);
      console.warn('Export path:', outputPath);
    }
  }

  runWebpackCompiler(webpack, loaderWebpackConfig)
    .then(() => {
      exportPlaygroundFiles(outputPath);
    })
    .then(
      () => {
        console.log('[Cosmos] Export Complete! Find the exported files here:');
        console.log(outputPath);
      },
      err => {
        console.error('[Cosmos] Export Failed! See error below:');
        console.error(err);
      }
    );
};
