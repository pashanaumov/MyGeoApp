import BackgroundFetch from 'react-native-background-fetch';
import Event from './Event';
import React, {useEffect, useState} from 'react';
import {Alert} from 'react-native';

export function useBackgroundFetch() {
  const [enabled, setEnabled] = useState(false);
  const [events, setEvents] = React.useState<Event[]>([]);

  const onScheduleTask = () => {
    BackgroundFetch.scheduleTask({
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

  const initBackgroundFetch = async () => {
    await BackgroundFetch.configure(
      {
        minimumFetchInterval: 15, // <-- minutes (15 is minimum allowed)
        stopOnTerminate: false,
        enableHeadless: true,
        startOnBoot: true,
        // Android options
        forceAlarmManager: false, // <-- Set true to bypass JobScheduler.
        requiredNetworkType: BackgroundFetch.NETWORK_TYPE_NONE, // Default
        requiresCharging: false, // Default
        requiresDeviceIdle: false, // Default
        requiresBatteryNotLow: false, // Default
        requiresStorageNotLow: false, // Default
      },
      async (taskId: string) => {
        console.log('[BackgroundFetch] taskId', taskId);
        // Create an Event record.
        const event = await Event.create(taskId, true);
        // Update state.
        setEvents(prev => [...prev, event]);
        // Finish.
        BackgroundFetch.finish(taskId);
      },
      (taskId: string) => {
        // Oh No!  Our task took too long to complete and the OS has signalled
        // that this task must be finished immediately.
        console.log('[Fetch] TIMEOUT taskId:', taskId);
        BackgroundFetch.finish(taskId);
      },
    );
    onEnable(true);
  };

  const initFetchMechanism = async () => {
    await initBackgroundFetch().then(() => {
      onScheduleTask();
    });
  };

  const loadEvents = () => {
    Event.all()
      .then(data => {
        console.log(data);
        setEvents(data);
      })
      .catch(error => {
        Alert.alert('Error', 'Failed to load data from AsyncStorage: ' + error);
      });
  };

  const onEnable = (_enabled: boolean) => {
    if (_enabled) {
      BackgroundFetch.start();
    } else {
      BackgroundFetch.stop();
    }
  };

  const onClear = () => {
    Event.destroyAll();
    setEvents([]);
  };

  useEffect(() => {
    loadEvents();
  }, []);

  return {
    initBackgroundFetch,
    onScheduleTask,
    onClear,
    loadEvents,
    events,
    initFetchMechanism,
  };
}
