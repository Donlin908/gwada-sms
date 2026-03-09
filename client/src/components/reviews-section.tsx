import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Review } from "@shared/schema";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

function StarRating({ value, onChange, readonly }: { value: number; onChange?: (v: number) => void; readonly?: boolean }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-6 h-6 transition-colors ${
            star <= (hovered || value)
              ? "fill-yellow-400 text-yellow-400"
              : "text-gray-300 dark:text-gray-600"
          } ${!readonly ? "cursor-pointer" : ""}`}
          onClick={() => !readonly && onChange?.(star)}
          onMouseEnter={() => !readonly && setHovered(star)}
          onMouseLeave={() => !readonly && setHovered(0)}
          data-testid={`star-${star}`}
        />
      ))}
    </div>
  );
}

export function ReviewsSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const { data: reviewsList = [] } = useQuery<Review[]>({
    queryKey: ["/api/reviews"],
  });

  const mutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/reviews", { name, rating, comment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reviews"] });
      setSubmitted(true);
      setName("");
      setRating(0);
      setComment("");
    },
    onError: (err: any) => {
      toast({
        title: "Erreur",
        description: err.message || "Impossible d'envoyer votre avis.",
        variant: "destructive",
      });
    },
  });

  const avgRating =
    reviewsList.length > 0
      ? reviewsList.reduce((sum, r) => sum + r.rating, 0) / reviewsList.length
      : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      toast({ title: "Note requise", description: "Veuillez sélectionner une note.", variant: "destructive" });
      return;
    }
    mutation.mutate();
  };

  return (
    <section className="py-16 bg-muted/30" id="avis">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold mb-2">Avis clients</h2>
          {reviewsList.length > 0 && (
            <div className="flex items-center justify-center gap-2 mt-2">
              <StarRating value={Math.round(avgRating)} readonly />
              <span className="text-lg font-semibold">{avgRating.toFixed(1)}/5</span>
              <span className="text-muted-foreground text-sm">({reviewsList.length} avis)</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-xl font-semibold mb-4">Laisser un avis</h3>
            {submitted ? (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6 text-center">
                <div className="text-4xl mb-2">🎉</div>
                <p className="font-semibold text-green-700 dark:text-green-400">Merci pour votre avis !</p>
                <p className="text-sm text-muted-foreground mt-1">Votre retour nous aide à améliorer le service.</p>
                <Button variant="ghost" size="sm" className="mt-3" onClick={() => setSubmitted(false)} data-testid="button-new-review">
                  Laisser un autre avis
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 bg-card border rounded-xl p-6 shadow-sm">
                <div>
                  <label className="text-sm font-medium mb-1 block">Votre nom</label>
                  <Input
                    placeholder="Ex: Marie D."
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    minLength={2}
                    maxLength={50}
                    data-testid="input-review-name"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Note</label>
                  <StarRating value={rating} onChange={setRating} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Commentaire</label>
                  <Textarea
                    placeholder="Décrivez votre expérience avec GWADA SMS..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    required
                    minLength={10}
                    maxLength={500}
                    rows={4}
                    data-testid="input-review-comment"
                  />
                  <p className="text-xs text-muted-foreground mt-1">{comment.length}/500 caractères</p>
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={mutation.isPending}
                  data-testid="button-submit-review"
                >
                  {mutation.isPending ? "Envoi en cours..." : "Envoyer mon avis"}
                </Button>
              </form>
            )}
          </div>

          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
            {reviewsList.length === 0 ? (
              <div className="text-center text-muted-foreground py-12 bg-card border rounded-xl">
                <div className="text-4xl mb-2">💬</div>
                <p>Aucun avis pour l'instant.</p>
                <p className="text-sm">Soyez le premier à partager votre expérience !</p>
              </div>
            ) : (
              reviewsList.map((review) => (
                <div key={review.id} className="bg-card border rounded-xl p-4 shadow-sm" data-testid={`card-review-${review.id}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-sm" data-testid={`text-reviewer-name-${review.id}`}>{review.name}</p>
                      <StarRating value={review.rating} readonly />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(review.createdAt), "d MMM yyyy", { locale: fr })}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1" data-testid={`text-review-comment-${review.id}`}>{review.comment}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
