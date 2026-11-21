import Foundation
import Capacitor
import MediaPlayer
import MessageUI
import UIKit

/// Friday's phone add-on.
///   Music: play, pause, skip and "play <artist / song / playlist / album>" from the iPhone's Music library.
///   Texts: opens a message with the recipient and words filled in, inside the app. iPhone always needs you to tap Send.
/// Anything that fails is rejected, and the app hands the job to the Shortcut instead.
@objc(FridayKitPlugin)
public class FridayKitPlugin: CAPPlugin, CAPBridgedPlugin, MFMessageComposeViewControllerDelegate {
    public let identifier = "FridayKitPlugin"
    public let jsName = "FridayKit"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "musicControl", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "musicPlay", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "nowPlaying", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "canText", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "composeText", returnType: CAPPluginReturnPromise)
    ]

    private var textCall: CAPPluginCall?

    // ---------- music ----------
    private func authorize(_ done: @escaping (Bool) -> Void) {
        let s = MPMediaLibrary.authorizationStatus()
        if s == .authorized {
            done(true)
            return
        }
        if s == .notDetermined {
            MPMediaLibrary.requestAuthorization { st in
                DispatchQueue.main.async { done(st == .authorized) }
            }
            return
        }
        done(false)
    }

    private func stateName(_ p: MPMusicPlayerController) -> String {
        switch p.playbackState {
        case .playing: return "playing"
        case .paused: return "paused"
        case .stopped: return "stopped"
        default: return "other"
        }
    }

    @objc func musicControl(_ call: CAPPluginCall) {
        let action = call.getString("action") ?? "toggle"
        authorize { ok in
            guard ok else {
                call.reject("music-denied")
                return
            }
            DispatchQueue.main.async {
                let p = MPMusicPlayerController.systemMusicPlayer
                switch action {
                case "play": p.play()
                case "pause": p.pause()
                case "next": p.skipToNextItem()
                case "previous": p.skipToPreviousItem()
                case "restart": p.skipToBeginning()
                case "shuffle":
                    p.shuffleMode = .songs
                    p.play()
                default:
                    if p.playbackState == .playing { p.pause() } else { p.play() }
                }
                call.resolve(["state": self.stateName(p), "title": p.nowPlayingItem?.title ?? "", "artist": p.nowPlayingItem?.artist ?? ""])
            }
        }
    }

    private func songs(matching q: String, property: String) -> [MPMediaItem] {
        let query = MPMediaQuery.songs()
        query.addFilterPredicate(MPMediaPropertyPredicate(value: q, forProperty: property, comparisonType: .contains))
        return query.items ?? []
    }

    private func find(_ q: String, kind: String) -> (MPMediaItemCollection, String)? {
        if kind == "playlist" || kind == "any" {
            let pq = MPMediaQuery.playlists()
            pq.addFilterPredicate(MPMediaPropertyPredicate(value: q, forProperty: MPMediaPlaylistPropertyName, comparisonType: .contains))
            if let pl = pq.collections?.first as? MPMediaPlaylist, !pl.items.isEmpty {
                return (MPMediaItemCollection(items: pl.items), pl.name ?? q)
            }
        }
        if kind == "artist" || kind == "any" {
            let items = songs(matching: q, property: MPMediaItemPropertyArtist)
            if !items.isEmpty { return (MPMediaItemCollection(items: items), items[0].artist ?? q) }
        }
        if kind == "song" || kind == "any" {
            let items = songs(matching: q, property: MPMediaItemPropertyTitle)
            if !items.isEmpty { return (MPMediaItemCollection(items: [items[0]]), items[0].title ?? q) }
        }
        if kind == "album" || kind == "any" {
            let items = songs(matching: q, property: MPMediaItemPropertyAlbumTitle)
            if !items.isEmpty { return (MPMediaItemCollection(items: items), items[0].albumTitle ?? q) }
        }
        return nil
    }

    @objc func musicPlay(_ call: CAPPluginCall) {
        let q = (call.getString("query") ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let kind = call.getString("kind") ?? "any"
        let shuffle = call.getBool("shuffle") ?? false
        authorize { ok in
            guard ok else {
                call.reject("music-denied")
                return
            }
            DispatchQueue.main.async {
                let p = MPMusicPlayerController.systemMusicPlayer
                if q.isEmpty {
                    if shuffle { p.shuffleMode = .songs }
                    p.play()
                    call.resolve(["title": p.nowPlayingItem?.title ?? "", "kind": "resume"])
                    return
                }
                guard let found = self.find(q, kind: kind) else {
                    call.reject("not-found")
                    return
                }
                p.setQueue(with: found.0)
                p.shuffleMode = shuffle ? .songs : .off
                p.prepareToPlay { _ in
                    DispatchQueue.main.async {
                        p.play()
                        call.resolve(["title": found.1, "count": found.0.count])
                    }
                }
            }
        }
    }

    @objc func nowPlaying(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let p = MPMusicPlayerController.systemMusicPlayer
            call.resolve(["state": self.stateName(p), "title": p.nowPlayingItem?.title ?? "", "artist": p.nowPlayingItem?.artist ?? ""])
        }
    }

    // ---------- texts ----------
    @objc func canText(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            call.resolve(["ok": MFMessageComposeViewController.canSendText()])
        }
    }

    @objc func composeText(_ call: CAPPluginCall) {
        let to = call.getArray("to", String.self) ?? []
        let body = call.getString("body") ?? ""
        DispatchQueue.main.async {
            guard MFMessageComposeViewController.canSendText() else {
                call.reject("cannot-text")
                return
            }
            guard let vc = self.bridge?.viewController else {
                call.reject("no-view")
                return
            }
            if let old = self.textCall {
                old.resolve(["result": "cancelled"])
            }
            let m = MFMessageComposeViewController()
            m.recipients = to
            m.body = body
            m.messageComposeDelegate = self
            self.textCall = call
            vc.present(m, animated: true)
        }
    }

    public func messageComposeViewController(_ controller: MFMessageComposeViewController, didFinishWith result: MessageComposeResult) {
        controller.dismiss(animated: true)
        let r: String
        switch result {
        case .sent: r = "sent"
        case .cancelled: r = "cancelled"
        case .failed: r = "failed"
        @unknown default: r = "unknown"
        }
        textCall?.resolve(["result": r])
        textCall = nil
    }
}
