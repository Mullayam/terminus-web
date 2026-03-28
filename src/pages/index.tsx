import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"

import { Terminal, FileType2, Sparkles, Puzzle, Code2, Camera } from "lucide-react"

import { NavLink } from 'react-router-dom'

export interface HostsObject {
  id: string;
  host: string;
  port?: number;
  username: string;
  authMethod: "password" | "privateKey";
  password: string;
  privateKeyText: string;
  localName: string;
  saveCredentials: boolean;
}
const SelectService = () => {

  return (
    <>
      <div className="grid gap-6 md:grid-cols-2 lg:gap-12 max-w-4xl mx-auto p-4">

        <NavLink to="/ssh/connect" className="group">
          <Card className="transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl flex items-center space-x-2">
                <Terminal className="w-6 h-6 text-primary" />
                <span>SSH Web Terminal</span>
              </CardTitle>
              <CardDescription>Access your server through a web-based terminal</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Securely connect to your remote servers using our intuitive web-based SSH terminal. No additional software required.
              </p>
            </CardContent>
          </Card>
        </NavLink>

        <NavLink to="/ssh/sftp" className="group">
          <Card className="transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl flex items-center space-x-2">
                <FileType2 className="w-6 h-6 text-primary" />
                <span>SSH SFTP</span>
              </CardTitle>
              <CardDescription>Secure file transfer over SSH</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Transfer files securely between your local machine and remote servers using our user-friendly SFTP interface.
              </p>
            </CardContent>
          </Card>
        </NavLink>
      </div>

      {/* What's New */}
      <div className="max-w-4xl mx-auto p-4 mt-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              What&apos;s New
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                v3.0
              </span>
            </CardTitle>
            <CardDescription>Latest editor features and improvements</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Puzzle className="w-4 h-4 text-blue-500" />
                  38 Built-in Plugins
                </div>
                <ul className="text-xs text-muted-foreground space-y-1 ml-6 list-disc">
                  <li>Rainbow Indent, Bracket Pair Lines</li>
                  <li>Bookmarks, Smart Select, Cursor History</li>
                  <li>Comment Anchors with gutter icons</li>
                  <li>Text Transform (13 modes)</li>
                </ul>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Code2 className="w-4 h-4 text-green-500" />
                  Plugin Manager
                </div>
                <ul className="text-xs text-muted-foreground space-y-1 ml-6 list-disc">
                  <li>Enable/disable plugins at runtime</li>
                  <li>Settings persist across sessions</li>
                  <li>Search &amp; toggle from sidebar</li>
                  <li>Plugin count badge</li>
                </ul>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Camera className="w-4 h-4 text-purple-500" />
                  New Tools
                </div>
                <ul className="text-xs text-muted-foreground space-y-1 ml-6 list-disc">
                  <li>Code Screenshot (PNG export)</li>
                  <li>Paste as JSON / CSV→JSON</li>
                  <li>Toggle Comment Style</li>
                  <li>Parameter Hints &amp; Lightbulb</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

export default SelectService