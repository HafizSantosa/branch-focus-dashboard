import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: { signIn: "/login" },
  callbacks: {
    authorized: ({ token }) => token?.authenticated === true,
  },
});

export const config = {
  matcher: [
    "/((?!login|register|verify-email|forgot-password|reset-password|api/auth|api/health|_next/static|_next/image|favicon\\.ico|logo\\.png).*)",
  ],
};
