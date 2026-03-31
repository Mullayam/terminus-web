export { createVSCodeAPI } from "./vscode-api";
export type {
    VSCodeAPI,
    CommandsAPI,
    WindowAPI,
    WorkspaceAPI,
    LanguagesAPI,
    CompletionItem,
    CompletionItemProvider,
    HoverProvider,
    HoverResult,
    Diagnostic,
    FileChange,
    InputBoxOptions,
    QuickPickOptions,
} from "./vscode-api";
export { dialogService } from "./dialog-service";
export type {
    DialogRequest,
    ShowMessageRequest,
    ShowInputBoxRequest,
    ShowQuickPickRequest,
    MessageSeverity,
} from "./dialog-service";
export { notificationService } from "./notification-service";
export type {
    NotificationSeverity,
    NotificationOptions,
    ShowNotificationFn,
} from "./notification-service";
export { ExtensionDialogHost } from "./ExtensionDialogHost";
