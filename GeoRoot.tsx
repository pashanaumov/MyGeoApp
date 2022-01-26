import React, {useCallback, useEffect, useState} from 'react';
import {
  Button,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import BackgroundGeolocation, {
  MotionActivityEvent,
  Location,
  State,
  LocationError,
} from 'react-native-background-geolocation';
import ENV from './ENV';
import BackgroundFetchComponent from './BackgroundFetchComponent';
import {useBackgroundFetch} from './useBackgroundFetch';

const Colors = {
  gold: '#fedd1e',
  black: '#000',
  white: '#fff',
  lightGrey: '#ccc',
  blue: '#337AB7',
};

export const GeoRoot = () => {
  const {
    initBackgroundFetch,
    onScheduleTask,
    onClear,
    events,
    loadEvents,
    initFetchMechanism,
  } = useBackgroundFetch();

  const [enabled, setEnabled] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [location, setLocation] = useState<Location>(null);
  const [odometer, setOdometer] = useState(0);
  const [motionActivityEvent, setMotionActivityEvent] =
    useState<MotionActivityEvent>(null);
  const [testClicks, setTestClicks] = useState(0);
  const [clickBufferTimeout, setClickBufferTimeout] = useState<any>(0);

  const [saved, setSaved] = useState('');

  const [currentLocation, setCurrentLocation] = useState('');

  // Handy Util class for managing app/plugin Settings.

  /// Init BackgroundGeolocation when view renders.
  useEffect(() => {
    // Register BackgroundGeolocation event-listeners.

    // Auto-toggle [ play ] / [ pause ] button in bottom toolbar on motionchange events.
    const motionChangeSubscriber: any = BackgroundGeolocation.onMotionChange(
      location => {
        setCurrentLocation(JSON.stringify(location, null, 4));
        // setIsMoving(location.isMoving);
      },
    );
    // For printing the motion-activity in bottom toolbar.
    const activityChangeSubscriber: any =
      BackgroundGeolocation.onActivityChange(setMotionActivityEvent);

    const onHttp = BackgroundGeolocation.onHttp(response => {
      let status = response.status;
      let success = response.success;
      let responseText = response.responseText;
      console.log('[onHttp] ', response);
    });

    const onLocation = BackgroundGeolocation.onLocation(
      location => {
        // setCurrentLocation(JSON.stringify(location, null, 4));
      },
      error => {
        console.warn('[onLocation] ERROR: ', error);
      },
    );

    initBackgroundGeolocation().then(async () => {
      await initFetchMechanism();
    });

    return () => {
      motionChangeSubscriber.remove();
      activityChangeSubscriber.remove();
      onLocation.remove();
      onHttp.remove();
    };
  }, []);

  /// Location effect-handler
  useEffect(() => {
    if (!location) {
      return;
    }
    setOdometer(location.odometer);
  }, [location]);

  /// Configure BackgroundGeolocation.ready
  const initBackgroundGeolocation = async () => {
    const deviceInfo = await BackgroundGeolocation.getDeviceInfo();

    const params = {
      device: {
        ...deviceInfo,
        framework: 'ReactNative',
      },
    };

    const state: State = await BackgroundGeolocation.ready({
      // Debug
      reset: true,
      debug: true,
      logLevel: BackgroundGeolocation.LOG_LEVEL_VERBOSE,
      // Geolocation
      desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_NAVIGATION,
      disableElasticity: false,
      distanceFilter: 5,
      allowIdenticalLocations: false,
      stopTimeout: 5,
      // Permissions
      locationAuthorizationRequest: 'Always',
      backgroundPermissionRationale: {
        title:
          "Allow {applicationName} to access this device's location even when closed or not in use.",
        message:
          'This app collects location data to enable recording your trips to work and calculate distance-travelled.',
        positiveAction: 'Change to "{backgroundPermissionOptionLabel}"',
        negativeAction: 'Cancel',
      },
      // HTTP & Persistence
      autoSync: false,
      batchSync: true,
      url: ENV.TRACKER_HOST + '/locations',
      maxDaysToPersist: 14,
      // Application
      stopOnTerminate: false,
      startOnBoot: true,
      enableHeadless: true,
      params: {
        device: {
          ...deviceInfo,
          framework: 'ReactNative',
        },
      },
    });

    setOdometer(state.odometer);
    setEnabled(state.enabled);
    setIsMoving(state.isMoving || false); // <-- TODO re-define @prop isMoving? as REQUIRED in State

    if (!state.enabled) {
      onClickEnable(true);
    }
  };

  /// <Switch> handler to toggle the plugin on/off.
  const onClickEnable = (value: boolean) => {
    setEnabled(value);
    if (value) {
      BackgroundGeolocation.start().then();
    } else {
      BackgroundGeolocation.stop();
      // Toggle the [ > ] / [ || ] button in bottom-toolbar back to [ > ]
      setIsMoving(false);
    }
  };

  const onClickGetCurrentPosition = () => {
    BackgroundGeolocation.getCurrentPosition({
      persist: true,
      samples: 1,
      timeout: 30,
      extras: {
        getCurrentPosition: true,
      },
    })
      .then((location: Location) => {
        console.log('[getCurrentPosition] success: ', location);
      })
      .catch((error: LocationError) => {
        console.warn('[getCurrentPosition] error: ', error);
      });
  };

  const onSync = async () => {
    try {
      await BackgroundGeolocation.sync(records => {
        console.log('[sync] success: ', records);
      });
    } catch (e) {
      console.log('[sync] FAILURE: ', e);
    }
  };

  const getSaved = async () => {
    const _saved = await BackgroundGeolocation.getLocations();
    setSaved(JSON.stringify(_saved, null, 4));
  };

  const onPurge = async () => {
    await BackgroundGeolocation.destroyLocations();
    await getSaved();
  };

  useEffect(() => {
    getSaved();
  }, [currentLocation]);

  /////// UI

  const renderEvents = useCallback(() => {
    if (!events.length) {
      return (
        <Text style={{padding: 10, fontSize: 16}}>
          Waiting for BackgroundFetch events...
        </Text>
      );
    }
    return events
      .slice()
      .reverse()
      .map(event => (
        <View key={event.key} style={styles.event}>
          <View style={{flexDirection: 'row'}}>
            <Text style={styles.taskId}>
              {event.taskId}&nbsp;{event.isHeadless ? '[Headless]' : ''}
            </Text>
          </View>
          <Text style={styles.timestamp}>{event.timestamp}</Text>
        </View>
      ));
  }, [events]);

  const renderFetch = useCallback(() => {
    return (
      <SafeAreaView style={{flex: 1, backgroundColor: Colors.gold}}>
        <StatusBar barStyle={'light-content'} />
        <View style={styles.container}>
          <View style={styles.toolbar}>
            <Text style={styles.title}>BGFetch Demo</Text>
          </View>
          <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            style={styles.eventList}>
            {renderEvents()}
          </ScrollView>
          <View style={styles.toolbar}>
            <Text>&nbsp;</Text>
            <View style={{flex: 1}} />
            <Button title="clear" onPress={onClear} />
          </View>
        </View>
      </SafeAreaView>
    );
  }, [onClear, renderEvents]);

  return (
    <>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
        }}>
        {renderFetch()}
        <View
          style={{
            flex: 1,
            backgroundColor: 'red',
          }}>
          <Button title={'Sync man'} onPress={onSync} />
          <Button title={'Purge all'} onPress={onPurge} />
          <Button title={'Refresh events'} onPress={loadEvents} />
          <Button
            title={'onClickGetCurrentPosition'}
            onPress={onClickGetCurrentPosition}
          />
          <Button title={'get'} onPress={getSaved} />
        </View>
        <View
          style={{
            flex: 1,
            backgroundColor: 'orange',
            alignItems: 'center',
          }}>
          <Text
            style={{
              color: 'grey',
            }}>
            CURRENT LOCATION
          </Text>
          <Text>{currentLocation}</Text>
        </View>
        <View
          style={{
            flex: 1,
          }}>
          <Text>Acquired location</Text>
          <Text>{saved}</Text>
        </View>
      </ScrollView>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    flex: 1,
  },
  title: {
    fontSize: 24,
    flex: 1,
    fontWeight: 'bold',
    color: Colors.black,
  },
  eventList: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  event: {
    padding: 10,
    borderBottomWidth: 1,
    borderColor: Colors.lightGrey,
  },
  taskId: {
    color: Colors.blue,
    fontSize: 16,
    fontWeight: 'bold',
  },
  headless: {
    fontWeight: 'bold',
  },
  timestamp: {
    color: Colors.black,
  },
  toolbar: {
    height: 57,
    flexDirection: 'row',
    paddingLeft: 10,
    paddingRight: 10,
    alignItems: 'center',
    backgroundColor: Colors.gold,
  },
});
