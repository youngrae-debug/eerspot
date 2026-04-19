import Foundation
import UserNotifications

@objc(ScheduleReminderModule)
class ScheduleReminderModule: NSObject {
  private let identifierPrefix = "eerspot.schedule."
  private let maxScheduledReminderCount = 32

  @objc
  static func requiresMainQueueSetup() -> Bool {
    false
  }

  @objc(syncReminders:resolver:rejecter:)
  func syncReminders(
    _ reminders: [[String: Any]],
    resolver resolve: @escaping (Any?) -> Void,
    rejecter reject: @escaping (String, String, Error?) -> Void
  ) {
    let notificationCenter = UNUserNotificationCenter.current()

    if reminders.isEmpty {
      replacePendingReminders(reminders, notificationCenter: notificationCenter, resolve: resolve, reject: reject)
      return
    }

    notificationCenter.getNotificationSettings { settings in
      switch settings.authorizationStatus {
      case .authorized, .provisional, .ephemeral:
        self.replacePendingReminders(reminders, notificationCenter: notificationCenter, resolve: resolve, reject: reject)
      case .notDetermined:
        notificationCenter.requestAuthorization(options: [.alert, .badge, .sound]) { granted, error in
          if let error {
            reject("schedule_reminder_permission", "Failed to request notification permission.", error)
            return
          }

          guard granted else {
            resolve(nil)
            return
          }

          self.replacePendingReminders(reminders, notificationCenter: notificationCenter, resolve: resolve, reject: reject)
        }
      case .denied:
        resolve(nil)
      @unknown default:
        resolve(nil)
      }
    }
  }

  private func replacePendingReminders(
    _ reminders: [[String: Any]],
    notificationCenter: UNUserNotificationCenter,
    resolve: @escaping (Any?) -> Void,
    reject: @escaping (String, String, Error?) -> Void
  ) {
    notificationCenter.getPendingNotificationRequests { requests in
      let existingIdentifiers = requests.compactMap { request -> String? in
        request.identifier.hasPrefix(self.identifierPrefix) ? request.identifier : nil
      }

      if !existingIdentifiers.isEmpty {
        notificationCenter.removePendingNotificationRequests(withIdentifiers: existingIdentifiers)
      }

      let now = Date()
      let nextReminders = reminders
        .compactMap { reminder -> PendingReminder? in
          guard
            let identifier = reminder["identifier"] as? String,
            let title = reminder["title"] as? String,
            let body = reminder["body"] as? String,
            let fireDateValue = reminder["fireDate"] as? String,
            let fireDate = ISO8601DateFormatter().date(from: fireDateValue),
            fireDate > now
          else {
            return nil
          }

          return PendingReminder(
            identifier: identifier,
            title: title,
            body: body,
            fireDate: fireDate
          )
        }
        .sorted { left, right in
          left.fireDate < right.fireDate
        }
        .prefix(self.maxScheduledReminderCount)

      if nextReminders.isEmpty {
        resolve(nil)
        return
      }

      let dispatchGroup = DispatchGroup()
      var schedulingError: Error?

      nextReminders.forEach { reminder in
        dispatchGroup.enter()

        let content = UNMutableNotificationContent()
        content.title = reminder.title
        content.body = reminder.body
        content.sound = .default

        let dateComponents = Calendar.current.dateComponents(
          [.year, .month, .day, .hour, .minute, .second],
          from: reminder.fireDate
        )
        let trigger = UNCalendarNotificationTrigger(
          dateMatching: dateComponents,
          repeats: false
        )
        let request = UNNotificationRequest(
          identifier: reminder.identifier,
          content: content,
          trigger: trigger
        )

        notificationCenter.add(request) { error in
          if let error, schedulingError == nil {
            schedulingError = error
          }

          dispatchGroup.leave()
        }
      }

      dispatchGroup.notify(queue: .main) {
        if let schedulingError {
          reject("schedule_reminder_schedule", "Failed to schedule local reminders.", schedulingError)
          return
        }

        resolve(nil)
      }
    }
  }
}

private struct PendingReminder {
  let identifier: String
  let title: String
  let body: String
  let fireDate: Date
}
