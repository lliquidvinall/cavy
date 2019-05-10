// Internal: TestRunner is responsible for actually running through each
// suite of tests and executing the specs.
//
// It also presents the test results and ensures a report is sent to cavy-cli
// if necessary.
//
// component  - the Tester component within which the app is wrapped.
// testSuites - an array of TestScopes, each of which relate to a single suite
//              of tests.
// startDelay - length of time in ms that cavy should wait before starting
//              tests.
export default class TestRunner {

  constructor(component, testSuites, startDelay, sendReport) {
    this.component = component;
    this.testSuites = testSuites;
    this.startDelay = startDelay;
    // Using the sendReport prop is deprecated - cavy checks whether the
    // cavy-cli server is listening and sends a report if true.
    this.shouldSendReport = sendReport;
    this.testResults = [];
    this.errorCount = 0;
  }

  // Internal: Start tests after optional delay time.
  async run() {
    if (this.startDelay) { await this.pause(this.startDelay)};
    this.runTestSuites();
  }

  // Internal: Synchronously runs each test suite one after the other,
  // sending a test report to cavy-cli if needed.
  async runTestSuites() {
    const start = new Date();
    console.log(`Cavy test suite started at ${start}.`);

    // Iterate through each suite...
    for (let i = 0; i < this.testSuites.length; i++) {
      // And then through the suite's test cases...
      for (let j = 0; j < this.testSuites[i].testCases.length; j++) {
        let scope = this.testSuites[i];
        // And run each test, within the test scope.
        await this.runTest(scope, scope.testCases[j]);
      }
    }

    const stop = new Date();
    const duration = (stop - start) / 1000;
    console.log(`Cavy test suite stopped at ${stop}, duration: ${duration} seconds.`);

    // Compile the report object.
    const report = {
      results: this.testResults,
      errorCount: this.errorCount,
      duration: duration
    }

    if (this.shouldSendReport != undefined) {
      const message = 'Deprecation warning: using the `sendReport` prop is ' +
                      'deprecated. By default, Cavy now checks whether the ' +
                      'cavy-cli server is running and sends a report if a ' +
                      'connection is detected.'
      console.warn(message);

      if (!this.shouldSendReport) return;
    }

    // Send report to reporter (default is cavy-cli)
    await this.reportResults(report);
  }

  // Internal: Synchronously runs each test case within a test suite, outputting
  // on the console if the test passes or fails, and adding to testResult
  // array for reporting purposes.
  //
  // Order of actions:
  // 1. Clears AsyncStorage
  // 2. Calls a beforeEach function
  // 3. Re-renders the app
  // 4. Runs the test
  async runTest(scope, test) {
    await this.component.clearAsync();
    if (scope.beforeEach) { await scope.beforeEach.call(scope) };
    this.component.reRender();

    // Run the test, console logging the result.
    let { description, f } = test;
    try {
      await f.call(scope);
      let successMsg = `${description}  ✅`;

      console.log(successMsg);
      this.testResults.push({message: successMsg, passed: true});
    } catch (e) {
      let errorMsg = `${description}  ❌\n   ${e.message}`;

      console.warn(errorMsg);
      this.testResults.push({message: errorMsg, passed: false});
      // Increase error count for reporting.
      this.errorCount += 1;
    }
  }

  // Internal: Check that cavy-cli server is running and if so, send report.
  async reportResults(report) {
    const url = 'http://127.0.0.1:8082/';

    try {
      const response = await fetch(url);
      const text = await response.text();

      if (text == 'cavy-cli running') {
        return this.send(report);
      } else {
        throw new Error('Unexpected response');
      }
    } catch (e) {
      console.log(`Skipping sending test report to cavy-cli - ${e.message}.`)
    }
  }

  // Internal: Make a post request to the cavy-cli server with the test report.
  async send(report) {
    const url = 'http://127.0.0.1:8082/report';

    const options = {
      method: 'POST',
      body: JSON.stringify(report),
      headers: { 'Content-Type': 'application/json' }
    };

    try {
      await fetch(url, options);
      console.log('Cavy test report successfully sent to cavy-cli');
    } catch (e) {
      this.handleError(e, url);
    }
  }

  handleError(error, url) {
    if (error.message.match(/Network request failed/)) {
      console.group(`Cavy test report server is not running at ${url}`);
      console.log("If you are using cavy-cli, maybe it's not set up correctly or not reachable from this device?");
      console.groupEnd();
    } else {
      console.group('Error sending test results')
      console.warn(error.message);
      console.groupEnd();
    }
  }

  // Internal: Pauses the test runner for a length of time.
  // Returns a promise.
  async pause(time) {
    let promise = new Promise((resolve, reject) => {
      setTimeout(function() {
        resolve();
      }, time);
    });

    return promise;
  }
}
