import { Link } from '@/i18n/routing';
import ForgotPass from "@/components/partials/auth/forgot-pass";
import Image from "next/image";
import Copyright from "@/components/partials/auth/copyright";
import Logo from "@/components/partials/auth/logo";

const ForgotPassPage = () => {
  return (
    <div className="flex w-full items-center overflow-hidden min-h-dvh h-dvh basis-full">
      <div className="overflow-y-auto flex flex-wrap w-full h-dvh">
        <div className="lg:block hidden flex-1 overflow-hidden text-[40px] leading-[48px] text-default-600 relative z-1 bg-default-50">
          <div className="max-w-[520px] pt-20 ps-20">
            <Link href="/" className="mb-6 inline-block">
              <Logo />
            </Link>


          </div>
          <div className="absolute left-7 bottom-[-15px] h-full w-[90%] z-[-1]">
            <Image
              width={300}
              height={300}
              src="/images/auth/driver.svg"
              priority
              alt=""
              className="h-full w-full object-contain"
            />
          </div>
        </div>
        <div className="flex-1 relative dark:bg-default-100 bg-white">
          <div className=" h-full flex flex-col ">
            <div className="max-w-[524px] mx-auto  w-full  md:px-[42px] md:py-[44px] p-7 text-2xl text-default-900  mb-3 flex flex-col justify-center h-full">
              <div className="flex justify-center items-center text-center mb-6 lg:hidden ">
                <Link href="/">
                  <Logo />
                </Link>
              </div>
              <div className="text-center 2xl:mb-10 mb-5">
                <h4 className="font-medium mb-4">Forgot Your Password?</h4>
              </div>

              <ForgotPass />
              <div className="md:max-w-[345px] mx-auto font-normal text-default-500  2xl:mt-12 mt-8 uppercase text-sm">
                <Link
                  href="/"
                  className="text-default-900  font-medium hover:underline px-2"
                >
                  Go Back
                </Link>
                to The Sign In
              </div>
            </div>
            <div className="text-xs font-normal text-default-500  z-[999] pb-10 text-center">
              <Copyright />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassPage;
