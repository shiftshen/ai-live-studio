import Cocoa
import WebKit
import UniformTypeIdentifiers
final class AppDelegate: NSObject, NSApplicationDelegate {
    var window: NSWindow!
    var webView: WKWebView?
    let input=NSTextField(string:"")
    func applicationDidFinishLaunching(_ notification: Notification) {
        window=NSWindow(contentRect:NSRect(x:0,y:0,width:432,height:768),styleMask:[.titled,.closable,.miniaturizable,.resizable,.fullSizeContentView],backing:.buffered,defer:false)
        window.title="AI Live Studio · 直播画面"
        window.titlebarAppearsTransparent=true;window.titleVisibility = .hidden
        for b in [NSWindow.ButtonType.closeButton,.miniaturizeButton,.zoomButton]{window.standardWindowButton(b)?.isHidden=true}
        window.setFrame(NSRect(x:100,y:100,width:432,height:768),display:true)
        let menu=NSMenu();let item=NSMenuItem();let submenu=NSMenu()
        submenu.addItem(withTitle:"刷新直播画面",action:#selector(reload),keyEquivalent:"r").target=self
        submenu.addItem(withTitle:"导出活动图片",action:#selector(exportImage),keyEquivalent:"e").target=self
        submenu.addItem(withTitle:"退出直播画面",action:#selector(NSApplication.terminate(_:)),keyEquivalent:"q")
        item.submenu=submenu;menu.addItem(item);NSApp.mainMenu=menu
        window.center();window.makeKeyAndOrderFront(nil)
        let panel=NSView(frame:NSRect(x:0,y:0,width:432,height:768))
        let label=NSTextField(labelWithString:"粘贴工作台的本机直播展示地址")
        label.frame=NSRect(x:24,y:620,width:384,height:30);panel.addSubview(label)
        input.frame=NSRect(x:24,y:570,width:384,height:32);input.placeholderString="http://127.0.0.1:8890/overlay/...";panel.addSubview(input)
        let button=NSButton(title:"打开直播画面",target:self,action:#selector(connect));button.frame=NSRect(x:24,y:518,width:180,height:36);panel.addSubview(button)
        window.contentView=panel;NSApp.activate(ignoringOtherApps:true)
    }
    @objc func connect(){
        guard let url=URL(string:input.stringValue.trimmingCharacters(in:.whitespacesAndNewlines)),
            url.scheme=="http",url.host=="127.0.0.1",url.path.hasPrefix("/overlay/"),
            URLComponents(url:url,resolvingAgainstBaseURL:false)?.queryItems?.contains(where:{$0.name=="token" && !($0.value ?? "").isEmpty})==true
        else{input.placeholderString="请使用工作台生成的完整本机展示地址";input.stringValue="";return}
        let config=WKWebViewConfiguration();config.mediaTypesRequiringUserActionForPlayback=[]
        let web=WKWebView(frame:window.contentView!.bounds,configuration:config)
        webView=web;window.contentView=web;web.load(URLRequest(url:url))
    }
    @objc func reload(){webView?.reload()}
    @objc func exportImage(){
        guard let web=webView else{return}
        let config=WKSnapshotConfiguration();config.snapshotWidth=1080
        web.takeSnapshot(with:config){[weak self] image,error in
            guard let self=self,let data=image?.tiffRepresentation,
                let bitmap=NSBitmapImageRep(data:data),
                let png=bitmap.representation(using:.png,properties:[:]) else{return}
            let panel=NSSavePanel();panel.allowedContentTypes=[.png]
            panel.nameFieldStringValue=web.title?.contains("Thai")==true ? "activity-th.png" : "activity-zh.png"
            panel.beginSheetModal(for:self.window){response in
                guard response == .OK,let url=panel.url else{return}
                do{try png.write(to:url,options:.atomic)}
                catch{let alert=NSAlert(error:error);alert.beginSheetModal(for:self.window)}
            }
        }
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender:NSApplication)->Bool {true}
}
let app=NSApplication.shared;let delegate=AppDelegate();app.delegate=delegate;app.setActivationPolicy(.regular);app.run()
