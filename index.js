/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

import BackgroundGeolocation from 'react-native-background-geolocation';
import BackgroundFetch from 'react-native-background-fetch';

import ENV from './ENV';

AppRegistry.registerComponent(appName, () => App);

/**
 * BackgroundGeolocation Headless JS task.
 * For more information, see:  https://github.com/transistorsoft/react-native-background-geolocation/wiki/Android-Headless-Mode
 */
const BackgroundGeolocationHeadlessTask = async event => {
  let params = event.params;
  console.log('[BackgroundGeolocation HeadlessTask] -', event.name, params);

  await BackgroundGeolocation.getLocations(locations => {
    console.log(locations);
  });

  switch (event.name) {
    case 'heartbeat':
      break;
    case 'authorization':
      BackgroundGeolocation.setConfig({
        url: ENV.TRACKER_HOST + '/api/locations',
      });
      break;
  }
};

BackgroundGeolocation.registerHeadlessTask(BackgroundGeolocationHeadlessTask);

/**
 * BackgroundFetch Headless JS Task.
 * For more information, see:  https://github.com/transistorsoft/react-native-background-fetch#config-boolean-enableheadless-false
 */

const onScheduleTask = async () => {
  await BackgroundFetch.scheduleTask({
    taskId: 'react-native-background-fetch',
    // delay: 900000,
    delay: 1000 * 60 * 1,
    stopOnTerminate: false,
    enableHeadless: true,
    startOnBoot: true,
    periodic: true,
    forceAlarmManager: true,
  })
    .then(() => {
      console.log('scheduleTask', 'Scheduled task with delay: 30000ms');
    })
    .catch(error => {
      console.log('scheduleTask ERROR', error);
    });
};

const BackgroundFetchHeadlessTask = async event => {
  console.log('[BackgroundFetch HeadlessTask] start', event.taskId);

  if (event.taskId === 'ru.eapteka.locations') {
    try {
      const saved = await BackgroundGeolocation.getLocations();
      if (saved) {
        await BackgroundGeolocation.sync();
      }
    } catch (e) {
      console.log(e);
    }
  }
  // Important:  await asychronous tasks when using HeadlessJS.
  /* DISABLED
  const location = await BackgroundGeolocation.getCurrentPosition({persist: false, samples: 1});
  console.log('- current position: ', location);
  // Required:  Signal to native code that your task is complete.
  // If you don't do this, your app could be terminated and/or assigned
  // battery-blame for consuming too much time in background.
  */
  console.log('[BackgroundFetch HeadlessTask] finished');

  BackgroundFetch.finish(event.taskId);

  await onScheduleTask();
  await BackgroundGeolocation.getCurrentPosition();
};

// Register your BackgroundFetch HeadlessTask
BackgroundFetch.registerHeadlessTask(BackgroundFetchHeadlessTask);
