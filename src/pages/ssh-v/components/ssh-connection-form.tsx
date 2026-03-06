/* eslint-disable @typescript-eslint/no-explicit-any */

import { Loader2, X, Server, User, KeyRound, Lock, Upload, FileKey, Save, RotateCcw, Hash } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { UseFormReturn } from "react-hook-form"
import { Checkbox } from "@/components/ui/checkbox"
import { Eye, EyeOff } from 'lucide-react';
import { useState, useCallback, useRef, useMemo } from "react"
import { useSSHStore } from "@/store/sshStore"

/* ── Inline SVG icons for username detection ── */

const UbuntuIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-.47 15.88c-3.23-.2-5.81-2.86-5.89-6.12-.09-3.58 2.83-6.54 6.39-6.42 3.05.1 5.6 2.56 5.85 5.6.03.38-.26.7-.64.7h-.02a.63.63 0 01-.62-.58c-.21-2.45-2.3-4.36-4.82-4.25-2.53.11-4.53 2.24-4.4 4.78.12 2.34 2.05 4.22 4.39 4.33.3.01.55.24.59.54.04.34-.22.63-.55.64-.1 0-.19 0-.28-.02zM7.5 12c0 .55-.45 1-1 1s-1-.45-1-1 .45-1 1-1 1 .45 1 1zm10 2c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-3-5.5c-.28.48-.9.64-1.38.36s-.64-.9-.36-1.38c.28-.48.9-.64 1.38-.36.48.28.64.9.36 1.38z" />
  </svg>
);

const AWSIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M6.763 10.036c0 .296.032.535.088.71.064.176.144.368.256.576.04.063.056.127.056.183 0 .08-.048.16-.152.24l-.503.335a.383.383 0 01-.208.072c-.08 0-.16-.04-.239-.112a2.47 2.47 0 01-.287-.375 6.18 6.18 0 01-.248-.471c-.622.734-1.405 1.101-2.347 1.101-.67 0-1.205-.191-1.596-.574-.391-.384-.59-.894-.59-1.533 0-.678.239-1.23.726-1.644.487-.415 1.133-.623 1.955-.623.272 0 .551.024.846.064.296.04.6.104.918.176v-.583c0-.607-.127-1.03-.375-1.277-.255-.248-.686-.367-1.3-.367-.28 0-.568.032-.862.104-.295.072-.583.16-.862.272a2.287 2.287 0 01-.28.104.488.488 0 01-.127.024c-.112 0-.168-.08-.168-.247v-.391c0-.128.016-.224.056-.28a.597.597 0 01.224-.167c.279-.144.614-.264 1.005-.36a4.84 4.84 0 011.246-.152c.95 0 1.644.216 2.091.648.44.432.662 1.085.662 1.963v2.586zm-3.24 1.214c.263 0 .534-.048.822-.144.287-.096.543-.271.758-.51.128-.152.224-.32.272-.512.047-.191.08-.423.08-.694v-.335a6.66 6.66 0 00-.735-.136 6.02 6.02 0 00-.75-.048c-.535 0-.926.104-1.19.32-.263.215-.39.518-.39.917 0 .375.095.655.295.846.191.2.47.296.838.296zm6.41.862c-.144 0-.24-.024-.304-.08-.064-.048-.12-.16-.168-.311L7.586 5.55a1.398 1.398 0 01-.072-.32c0-.128.064-.2.191-.2h.783c.151 0 .255.025.31.08.065.048.113.16.16.312l1.342 5.284 1.245-5.284c.04-.16.088-.264.151-.312a.549.549 0 01.32-.08h.638c.152 0 .256.025.32.08.063.048.12.16.151.312l1.261 5.348 1.381-5.348c.048-.16.104-.264.16-.312a.52.52 0 01.311-.08h.743c.127 0 .2.065.2.2 0 .04-.009.08-.017.128a1.137 1.137 0 01-.056.2l-1.923 6.17c-.048.16-.104.264-.168.312a.549.549 0 01-.304.08h-.687c-.151 0-.255-.024-.32-.08-.063-.056-.119-.16-.15-.32l-1.238-5.148-1.23 5.14c-.04.16-.087.272-.15.328-.064.056-.176.08-.32.08zm10.256.215c-.415 0-.83-.048-1.229-.143-.399-.096-.71-.2-.918-.32-.128-.071-.216-.151-.248-.215a.563.563 0 01-.048-.224v-.407c0-.167.064-.247.183-.247.048 0 .096.008.144.024s.12.048.2.08c.271.12.566.215.878.279.319.064.63.096.95.096.502 0 .894-.088 1.165-.264a.86.86 0 00.415-.758.777.777 0 00-.215-.559c-.144-.151-.415-.287-.806-.415l-1.157-.36c-.583-.183-1.014-.455-1.277-.815a1.903 1.903 0 01-.4-1.19c0-.343.073-.643.224-.901.151-.264.35-.487.599-.672.248-.191.535-.327.862-.415.328-.088.68-.128 1.053-.128.184 0 .375.008.559.032.191.024.367.056.535.088.16.04.312.08.455.127.144.048.256.096.336.144a.69.69 0 01.24.2.43.43 0 01.071.263v.375c0 .168-.064.256-.184.256a.83.83 0 01-.303-.096 3.652 3.652 0 00-1.532-.311c-.455 0-.815.071-1.062.223-.248.152-.375.383-.375.694 0 .224.08.416.24.567.159.152.454.304.877.44l1.134.358c.574.184.99.44 1.237.767.248.328.367.703.367 1.117 0 .343-.072.655-.207.926-.144.272-.336.511-.583.703-.248.2-.543.343-.886.44-.36.104-.735.152-1.142.152z" />
    <path d="M21.725 16.943C19.155 18.867 15.395 19.88 12.14 19.88c-4.467 0-8.49-1.652-11.532-4.396-.24-.215-.024-.511.263-.343 3.283 1.91 7.343 3.06 11.54 3.06 2.83 0 5.94-.583 8.803-1.798.432-.191.798.28.511.54z" />
    <path d="M22.853 15.647c-.327-.416-2.167-.2-2.995-.104-.248.032-.287-.191-.063-.351 1.469-1.03 3.875-.735 4.155-.39.287.351-.08 2.78-1.453 3.94-.207.176-.407.08-.311-.152.303-.75.99-2.523.663-2.943z" />
  </svg>
);

const LinuxIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587-.003 1.23-.269 2.26-.334.699-.058 1.574.267 2.577.2.025.134.063.198.114.333l.003.003c.391.778 1.113 1.368 1.884 1.43.868.065 1.571-.284 1.773-.869.172.017.344.014.5-.08.394-.122.553-.517.564-.917.007-.325-.08-.635-.1-.928-.027-.388-.075-.81.005-1.179.053-.46.158-.95.278-1.443.035-.153.074-.307.11-.377.543-.11.906-.519 1.213-.899.405-.5.606-1.044.606-1.044s-.199-.093-.404.048c-.301.208-.7.636-.972.447-.306-.213-.378-.627-.375-1.091 0-.474.078-.972.133-1.393.078-.602.13-1.156-.004-1.625-.166-.518-.49-.907-.94-1.082-.455-.14-.775.036-1.015.252-.3.261-.5.605-.728.96-.118.186-.238.379-.37.538-.197.176-.46.306-.696.387-.195.069-.442.075-.654.06a.6.6 0 01-.155-.013c-.166-.04-.358-.123-.57-.09-.296.016-.463.166-.464.404a1.09 1.09 0 00.227.596c.204.284.498.46.798.593-.108.322-.213.7-.213 1.094 0 .466.12.866.345 1.146.09.108.22.193.362.218a.48.48 0 00.407-.11c.092-.3.132-.715.128-1.126-.01-.41-.066-.794-.098-1.024a2.36 2.36 0 00.45-.137c.252-.12.484-.273.677-.498.217-.258.375-.563.539-.9.21-.42.38-.788.622-1.005.121-.037.258-.076.408-.08.142 0 .292.033.447.089.238.084.348.328.432.67.09.378.088.848.037 1.377-.023.256-.075.56-.113.86l-.001.005c-.05.398-.104.831-.105 1.247-.008.707.17 1.458.711 1.74.21.1.408.157.544.136.064.05.142.068.244.065.192-.007.34-.1.396-.313a.84.84 0 00-.02-.48c-.03-.121.002-.285.058-.479.031-.141.078-.291.144-.468.074-.229.158-.476.238-.725.161-.501.319-1.016.369-1.418.202-.157.381-.37.532-.66.165-.32.246-.66.27-.92.024-.32-.015-.6-.082-.81a15.19 15.19 0 00-.173-.45c-.002-.026-.002-.05.002-.075zm-4.126 8.397c-.098.033-.22.117-.361.124a.7.7 0 01-.373-.082c-.13-.068-.262-.187-.355-.27a.86.86 0 01-.107-.117c.094.005.168.018.228.042.148.063.206.146.343.19.138.046.262.062.393.036.056-.01.085.004.141.04.059.035.098.068.091.037z" />
  </svg>
);

type UsernameBrand = {
  icon: React.FC<{ size?: number }>;
  color: string;
  gradient: string;
  border: string;
  label: string;
} | null;

function detectUsernameBrand(username: string): UsernameBrand {
  const u = username.toLowerCase().trim();
  if (!u) return null;

  if (u === 'ubuntu') {
    return { icon: UbuntuIcon, color: 'text-orange-400', gradient: 'from-orange-500/20 to-orange-500/5', border: 'border-orange-500/20', label: 'Ubuntu' };
  }
  if (u.startsWith('ec2') || u === 'aws' || u === 'amazon') {
    return { icon: AWSIcon, color: 'text-amber-400', gradient: 'from-amber-500/20 to-amber-500/5', border: 'border-amber-500/20', label: 'AWS' };
  }
  if (u === 'root' || u === 'admin') {
    return { icon: LinuxIcon, color: 'text-yellow-400', gradient: 'from-yellow-500/20 to-yellow-500/5', border: 'border-yellow-500/20', label: 'Linux' };
  }
  if (u === 'debian') {
    return { icon: LinuxIcon, color: 'text-red-400', gradient: 'from-red-500/20 to-red-500/5', border: 'border-red-500/20', label: 'Debian' };
  }
  if (u === 'centos') {
    return { icon: LinuxIcon, color: 'text-purple-400', gradient: 'from-purple-500/20 to-purple-500/5', border: 'border-purple-500/20', label: 'CentOS' };
  }
  if (u === 'pi' || u === 'raspberry') {
    return { icon: LinuxIcon, color: 'text-pink-400', gradient: 'from-pink-500/20 to-pink-500/5', border: 'border-pink-500/20', label: 'Raspberry Pi' };
  }
  return null;
}



export default function SSHConnectionForm<T>({ form, handleSubmit, isLoading, children
}: {
  form: UseFormReturn<any, any, any>,
  handleSubmit: (data: any) => Promise<void>
  isLoading: boolean,
  children?: React.ReactNode
}) {

  const { removeTab, activeTabId, tabs, setActiveTab, sessions, removeSession } = useSSHStore()

  const [showPassword, setShowPassword] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCloseForm = () => {
    if (activeTabId) {
      removeSession(activeTabId)
      removeTab(activeTabId)
    }
  }

  // Read uploaded file as UTF-8 and set privateKeyText
  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setFileName(file.name);

      try {
        const text = await file.text(); // reads as UTF-8 by default
        form.setValue('privateKeyText', text, { shouldValidate: true });
      } catch (err) {
        console.error('Failed to read file:', err);
      }
    },
    [form],
  );

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  // Detect brand from current username for header icon
  const currentUsername = form.watch('username') || '';
  const headerBrand = detectUsernameBrand(currentUsername);

  return (
    <div className="flex items-center justify-center p-4 min-h-[80vh]">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br flex items-center justify-center border transition-all duration-300 ${
              headerBrand 
                ? `${headerBrand.gradient} ${headerBrand.border} ${headerBrand.color}`
                : 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/20 text-emerald-400'
            }`}>
              {headerBrand ? (
                <headerBrand.icon size={20} />
              ) : (
                <Server size={18} />
              )}
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
                New Connection
                {headerBrand && (
                  <span className={`text-xs font-normal px-1.5 py-0.5 rounded ${headerBrand.color} bg-white/[0.05]`}>
                    {headerBrand.label}
                  </span>
                )}
              </h1>
              <p className="text-xs text-gray-500">Connect to a remote server via SSH</p>
            </div>
          </div>
          {children ? children : (
            <button
              onClick={handleCloseForm}
              className="p-2 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/[0.06] transition-colors"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Form Card */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden h-[650px] flex flex-col">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col h-full">
              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-emerald-500/20 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-emerald-500/40">
                {/* Host & Port Row */}
                <div className="grid grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="host"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel className="text-xs text-gray-400 flex items-center gap-1.5">
                        <Server size={12} />
                        Host
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="example.com or 192.168.1.1"
                          className="bg-white/[0.03] border-white/[0.08] focus:border-emerald-500/50 text-gray-200 placeholder:text-gray-600"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-xs text-orange-400" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="port"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-gray-400 flex items-center gap-1.5">
                        <Hash size={12} />
                        Port
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="22"
                          className="bg-white/[0.03] border-white/[0.08] focus:border-emerald-500/50 text-gray-200 placeholder:text-gray-600"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : '')}
                        />
                      </FormControl>
                      <FormMessage className="text-xs text-orange-400" />
                    </FormItem>
                  )}
                />
              </div>

              {/* Username */}
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => {
                  const brand = detectUsernameBrand(field.value || '');
                  return (
                    <FormItem>
                      <FormLabel className="text-xs text-gray-400 flex items-center gap-1.5">
                        <User size={12} />
                        Username
                        {brand && (
                          <span className={`ml-auto flex items-center gap-1 ${brand.color}`}>
                            <brand.icon size={12} />
                            <span className="text-[10px]">{brand.label}</span>
                          </span>
                        )}
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            placeholder="root, ubuntu, ec2-user..."
                            className={`bg-white/[0.03] border-white/[0.08] focus:border-emerald-500/50 text-gray-200 placeholder:text-gray-600 ${brand ? 'pr-9' : ''}`}
                            {...field}
                          />
                          {brand && (
                            <div className={`absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none ${brand.color}`}>
                              <brand.icon size={16} />
                            </div>
                          )}
                        </div>
                      </FormControl>
                      <FormMessage className="text-xs text-orange-400" />
                    </FormItem>
                  );
                }}
              />

              {/* Auth Method */}
              <FormField
                control={form.control}
                name="authMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-gray-400">Authentication</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex gap-2 pt-1"
                      >
                        <label
                          className={`flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg border cursor-pointer transition-all
                            ${field.value === 'password'
                              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                              : 'border-white/[0.08] bg-white/[0.02] text-gray-400 hover:border-white/[0.15]'
                            }`}
                        >
                          <RadioGroupItem value="password" className="sr-only" />
                          <Lock size={14} />
                          <span className="text-sm">Password</span>
                        </label>
                        <label
                          className={`flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg border cursor-pointer transition-all
                            ${field.value === 'privateKey'
                              ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                              : 'border-white/[0.08] bg-white/[0.02] text-gray-400 hover:border-white/[0.15]'
                            }`}
                        >
                          <RadioGroupItem value="privateKey" className="sr-only" />
                          <KeyRound size={14} />
                          <span className="text-sm">Private Key</span>
                        </label>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage className="text-xs text-orange-400" />
                  </FormItem>
                )}
              />

              {/* Password / Private Key - smooth transition */}
              <div className="transition-all duration-300 ease-in-out overflow-hidden">
                {form.watch("authMethod") === "password" ? (
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-gray-400 flex items-center gap-1.5">
                          <Lock size={12} />
                          Password
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder="Enter your password"
                              className="bg-white/[0.03] border-white/[0.08] focus:border-emerald-500/50 text-gray-200 placeholder:text-gray-600 pr-10"
                              {...field}
                            />
                            <button
                              type="button"
                              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-300 transition-colors"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage className="text-xs text-orange-400" />
                      </FormItem>
                    )}
                  />
                ) : (
                <div className="space-y-3">
                  <FormLabel className="text-xs text-gray-400 flex items-center gap-1.5">
                    <FileKey size={12} />
                    Private Key
                  </FormLabel>
                  <Tabs defaultValue="paste" className="w-full">
                    <TabsList className="w-full bg-white/[0.03] border border-white/[0.06] p-1 h-auto">
                      <TabsTrigger
                        value="paste"
                        className="flex-1 text-xs data-[state=active]:bg-amber-500/15 data-[state=active]:text-amber-400 text-gray-500"
                      >
                        Paste Key
                      </TabsTrigger>
                      <TabsTrigger
                        value="file"
                        className="flex-1 text-xs data-[state=active]:bg-amber-500/15 data-[state=active]:text-amber-400 text-gray-500"
                      >
                        Upload File
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="paste" className="mt-3 max-w-full overflow-hidden">
                      <FormField
                        control={form.control}
                        name="privateKeyText"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <div className="relative">
                                {showPrivateKey ? (
                                  <Textarea
                                    placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
                                    className="min-h-[140px] w-full bg-white/[0.03] border-white/[0.08] focus:border-amber-500/50 text-gray-200 placeholder:text-gray-600 font-mono text-xs resize-none pr-10"
                                    {...field}
                                  />
                                ) : (
                                  <div
                                    className="min-h-[140px] w-full bg-white/[0.03] border border-white/[0.08] rounded-md px-3 py-2 font-mono text-xs text-gray-500 cursor-text overflow-hidden"
                                    onClick={() => setShowPrivateKey(true)}
                                  >
                                    {field.value ? (
                                      <span className="select-none">{'•'.repeat(Math.min(field.value.length, 200))}</span>
                                    ) : (
                                      <span className="text-gray-600">-----BEGIN OPENSSH PRIVATE KEY-----<br />...<br />-----END OPENSSH PRIVATE KEY-----</span>
                                    )}
                                  </div>
                                )}
                                <button
                                  type="button"
                                  className="absolute top-2 right-2 p-1 rounded text-gray-500 hover:text-gray-300 hover:bg-white/[0.06] transition-colors"
                                  onClick={() => setShowPrivateKey(!showPrivateKey)}
                                  title={showPrivateKey ? 'Hide key' : 'Show key'}
                                >
                                  {showPrivateKey ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                              </div>
                            </FormControl>
                            <FormMessage className="text-xs text-orange-400" />
                          </FormItem>
                        )}
                      />
                    </TabsContent>
                    <TabsContent value="file" className="mt-3">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pem,.key,.ppk,.pub,.id_rsa,.id_ed25519,.id_ecdsa"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={triggerFileSelect}
                        className="w-full flex flex-col items-center justify-center gap-2 py-8 rounded-lg border-2 border-dashed border-white/[0.1] hover:border-amber-500/30 bg-white/[0.02] hover:bg-amber-500/5 transition-all cursor-pointer group"
                      >
                        <Upload size={24} className="text-gray-500 group-hover:text-amber-400 transition-colors" />
                        {fileName ? (
                          <span className="text-sm text-amber-400">{fileName}</span>
                        ) : (
                          <>
                            <span className="text-sm text-gray-400">Click to upload private key</span>
                            <span className="text-[10px] text-gray-600">.pem, .key, .ppk, id_rsa, id_ed25519</span>
                          </>
                        )}
                      </button>
                      {fileName && (
                        <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1">
                          <FileKey size={12} />
                          Key loaded into form
                        </p>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>
              )}
              </div>

              {/* Save Credentials */}
              <FormField
                control={form.control}
                name="saveCredentials"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        className="data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                      />
                    </FormControl>
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Save size={14} />
                      Save connection for quick access
                    </div>
                  </FormItem>
                )}
              />

              {/* Local Name (conditional) */}
              {form.watch("saveCredentials") && (
                <FormField
                  control={form.control}
                  name="localName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-gray-400">Connection Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="My Ubuntu Server"
                          className="bg-white/[0.03] border-white/[0.08] focus:border-emerald-500/50 text-gray-200 placeholder:text-gray-600"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-xs text-orange-400" />
                    </FormItem>
                  )}
                />
              )}
              </div>

              {/* Fixed Footer — Actions + Error */}
              <div className="shrink-0 border-t border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
                {/* Error Banner */}
                {activeTabId && sessions[activeTabId] && sessions[activeTabId].status === 'error' && (
                  <div className="px-3 py-2 rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 text-xs">
                    <span className="font-medium">Connection failed:</span> {sessions[activeTabId]?.error}
                  </div>
                )}
                
                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <Server size={16} className="mr-2" />
                        Connect
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      form.reset();
                      setFileName(null);
                    }}
                    className="border-white/[0.1] bg-white/[0.02] hover:bg-white/[0.06] text-gray-400"
                  >
                    <RotateCcw size={16} />
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  )
}