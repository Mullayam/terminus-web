import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"

import { Terminal, FileType2 } from "lucide-react"

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

        <NavLink to="/ssh/only-sftp" className="group">
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
    </>
  )
}

export default SelectService