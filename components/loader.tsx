
'use client'
import React from "react";
import { Loader2 } from "lucide-react";
import { useMounted } from "@/hooks/use-mounted";
const Loader = () => {
    const mounted = useMounted()
    return (
        mounted ? null : <div className=" h-screen flex items-center justify-center flex-col space-y-2">
            <div className="flex gap-2 items-center ">
                
                <h1 className="text-xl font-semibold text-default-900 ">
                    WBSC Dashboard
                </h1>
            </div>
            <span className=" inline-flex gap-1  items-center">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
            </span>
        </div>
    );
};

export default Loader;

