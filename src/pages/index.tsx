import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { getAllData } from "@/lib/idb"
import { Terminal, FileType2 } from "lucide-react"
import { useEffect, useState } from "react"
import { NavLink } from 'react-router-dom'
import { HostCard } from "./ssh/HostCard"
export interface HostsObject {
  id: string;
  host: string;
  username: string;
  authMethod: string;
  password: string;
  privateKeyText: string;
  localName: string;
  saveCredentials: boolean;
}
const SelectService = () => {
  const [hosts, setHosts] = useState<HostsObject[]>([])

  useEffect(() => {    
    getAllData<HostsObject>().then(data => setHosts(data))
  }, [])
  return (
    <>
      {hosts.length > 0 && (
        <div className="max-w-7xl mx-auto">
          <h2 className="text-white text-xl font-semibold mb-4">Hosts</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {hosts.map((host, index) => (
              <HostCard key={index} info={host} />
            ))}
          </div>
        </div>
      )}

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
    </>
  )
}

export default SelectService