#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(ScheduleReminderModule, NSObject)

RCT_EXTERN_METHOD(
  syncReminders:(NSArray<NSDictionary *> *)reminders
  resolver:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
)

@end
