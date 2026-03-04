export function Dashboard({ children }: { children: React.ReactNode }) {


    return <div className="flex flex-col overflow-hidden bg-[#0A0A0A] transition-all duration-300 ease-in-out"
        style={{ height: "100vh" }}>
        {children}
    </div>
}
