/* eslint-disable @typescript-eslint/no-explicit-any */

import { Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { UseFormReturn } from "react-hook-form"
import { Checkbox } from "@/components/ui/checkbox"
import { Eye, EyeOff } from 'lucide-react';
import { useState } from "react"
import { useSSHStore } from "@/store/sshStore"



export default function SSHConnectionForm<T>({ form, handleSubmit, isLoading, children
}: {
  form: UseFormReturn<any, any, any>,
  handleSubmit: (data: any) => Promise<void>
  isLoading: boolean,
  children?: React.ReactNode
}) {

  const { removeTab, activeTabId, tabs, setActiveTab, sessions, removeSession } = useSSHStore()

  const [showPassword, setShowPassword] = useState(false);
  const handleCloseForm = () => {
    if (activeTabId) {
      removeSession(activeTabId)
      removeTab(activeTabId)
    }
  }
  return (
    <div className="flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="space-y-1 flex flex-row items-center justify-between">

          <CardTitle>SSH Connection Form</CardTitle>
          {
            children ? children : <Button size={"icon"} variant={"outline"} onClick={handleCloseForm} className="rounded-full ">
              <X className="w-6 h-6 cursor-pointer" />

            </Button>
          }


        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="host"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Host Address</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. example.com or 192.168.1.1" {...field} />
                    </FormControl>
                    <FormMessage className="text-xs text-orange-300" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter your username" {...field} />
                    </FormControl>
                    <FormMessage className="text-xs text-orange-300" />

                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="authMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Authentication Method</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex flex-col sm:flex-row sm:space-x-4 space-y-2 sm:space-y-0"
                      >
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <RadioGroupItem value="password" />
                          </FormControl>
                          <FormLabel className="font-normal">Password</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <RadioGroupItem value="privateKey" />
                          </FormControl>
                          <FormLabel className="font-normal">Private Key</FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage className="text-xs text-orange-300" />

                  </FormItem>
                )}
              />
              {form.watch("authMethod") === "password" ? (
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter your password"
                            {...field}
                          />
                          <button
                            type="button"
                            className="absolute inset-y-0 right-0 pr-3 flex items-center"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                            ) : (
                              <Eye className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <Tabs defaultValue="paste" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="paste">Paste Private Key</TabsTrigger>
                    <TabsTrigger value="file" disabled>Choose File</TabsTrigger>
                  </TabsList>
                  <TabsContent value="paste">
                    <FormField
                      control={form.control}
                      name="privateKeyText"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Private Key</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Paste your private key here"
                              className="min-h-[200px]"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage className="text-xs text-orange-300" />

                        </FormItem>
                      )}
                    />
                  </TabsContent>
                  <TabsContent value="file">
                    <FormField
                      control={form.control}
                      name="privateKeyFile"
                      render={({ field: { onChange, ...field } }) => (
                        <FormItem>
                          <FormLabel>Private Key File</FormLabel>
                          <FormControl>
                            <Input
                              type="file"
                              accept=".pem,.key,.ppk"
                              onChange={(e) => onChange(e.target.files?.[0])}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TabsContent>
                </Tabs>
              )}
              <FormField
                control={form.control}
                name="saveCredentials"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        Save connection details in Browser for future use
                      </FormLabel>
                    </div>
                  </FormItem>
                )}
              />
              {
                form.watch("saveCredentials") && (
                  <FormField
                    control={form.control}
                    name="localName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Local Name</FormLabel>
                        <FormControl>
                          <Input  {...field} />
                        </FormControl>
                        <FormMessage className="text-xs text-orange-300" />

                      </FormItem>
                    )}
                  />

                )
              }
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  "Connect"
                )}
              </Button>
              <Button type="button" onClick={() => form.reset()} className="ml-2 bg-blue-500">
                Reset
              </Button>
            </form>
          </Form>
        </CardContent>
        {activeTabId && sessions[activeTabId] && sessions[activeTabId].status === 'error' && (
          <div className="flex items-center text-red-400 justify-between p-4">
            Error: {sessions[activeTabId]?.error}
          </div>
        )}

      </Card>
    </div>
  )
}