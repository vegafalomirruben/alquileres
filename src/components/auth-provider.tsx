"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        const session = localStorage.getItem("user_session");
        const isLoginPage = pathname === "/login";

        if (!session && !isLoginPage) {
            router.push("/login");
        } else if (session && isLoginPage) {
            router.push("/dashboard");
        }

        setIsLoading(false);
    }, [pathname, router]);

    if (isLoading) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-slate-50">
                <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
            </div>
        );
    }

    return <>{children}</>;
}
