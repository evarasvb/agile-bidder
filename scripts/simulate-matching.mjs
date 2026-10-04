import { build } from 'esbuild';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
const compiled = await build({entryPoints:['src/lib/matchingFixtures.ts'],bundle:true,platform:'node',format:'esm',write:false,alias:{'@':path.resolve('src')}});
const {matchingRegressionMatrix,regressionMetrics} = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
 const cases=matchingRegressionMatrix();
 const report={fixtureOnly:true,realDocumentsRead:0,additionalAiCalls:0,additionalPaidServices:0,
  measurement:'synthetic catalog candidate classification, not real-process relevance or compliance',
  before:regressionMetrics(cases,'before'),after:regressionMetrics(cases,'after'),cases};
 if(process.argv[2]) await writeFile(process.argv[2],JSON.stringify(report,null,2));
 console.log(JSON.stringify({cases:cases.length,before:report.before,after:report.after,fixtureOnly:true,additionalAiCalls:0}));

