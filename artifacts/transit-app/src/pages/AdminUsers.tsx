import { useListUsers, getListUsersQueryKey } from "@workspace/api-client-react";
import { PageTransition } from "@/components/PageTransition";
import { ChevronLeft, UserCircle, CheckCircle2, XCircle } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminUsers() {
  const { data: users, isLoading } = useListUsers({
    query: { queryKey: getListUsersQueryKey() }
  });

  return (
    <PageTransition className="min-h-screen bg-slate-50 p-6 sm:p-12">
      <div className="max-w-4xl mx-auto">
        <Button variant="ghost" className="mb-6 -ml-4" asChild>
          <Link href="/">
            <ChevronLeft className="w-4 h-4 mr-1" /> Home
          </Link>
        </Button>

        <h1 className="text-3xl font-bold tracking-tight mb-8 text-secondary">System Users</h1>

        <div className="bg-white border border-border shadow-sm rounded-2xl overflow-hidden">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
            </div>
          ) : users && users.length > 0 ? (
            <div className="divide-y divide-border">
              {users.map(user => (
                <div key={user.id} className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                  
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center">
                      <UserCircle className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg text-secondary">{user.name}</h3>
                      <p className="text-xs text-muted-foreground font-mono">ID: {user.id} • Joined {new Date(user.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-6 text-sm">
                    <div className="flex flex-col items-end">
                      <span className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Face Profile</span>
                      {user.face_enrolled ? (
                         <span className="flex items-center text-green-600 font-medium"><CheckCircle2 className="w-4 h-4 mr-1.5" /> Enrolled</span>
                      ) : (
                         <span className="flex items-center text-red-500 font-medium"><XCircle className="w-4 h-4 mr-1.5" /> Missing</span>
                      )}
                    </div>
                    
                    <Button variant="outline" size="sm" asChild className="ml-2">
                       <Link href={`/dashboard/${user.id}`}>View Dashboard</Link>
                    </Button>
                  </div>

                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-muted-foreground">
              No users registered in the system yet.
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
