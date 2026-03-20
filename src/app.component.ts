import { Component, ChangeDetectionStrategy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface CoinPackage {
  id: number;
  coins: number;
  price: number;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule]
})
export class AppComponent {
  // Constants and State
  readonly PRICE_PER_COIN = 0.054; // Calculated from 378 BRL / 7000 coins

  packages = signal<CoinPackage[]>([
    { id: 1, coins: 70, price: 3.78 },
    { id: 2, coins: 350, price: 18.9 },
    { id: 3, coins: 700, price: 37.8 },
    { id: 4, coins: 1400, price: 75.6 },
    { id: 5, coins: 3500, price: 189 },
    { id: 6, coins: 7000, price: 378 },
    { id: 7, coins: 17500, price: 945 },
  ]);
  
  selectedPackageId = signal<number | 'custom' | null>(null);
  customAmount = signal<number>(0);
  recipientUsername = signal<string>('');
  searchedProfile = signal<{ profilePicture: string, username: string, displayName: string, followerCount: number } | null>(null);
  isSearching = signal(false);
  searchError = signal<string | null>(null);
  showConfirmationModal = signal(false);
  showSuccessModal = signal(false);
  showBankNotification = signal(false);

  totalCoins = computed(() => {
    const selectedId = this.selectedPackageId();
    if (selectedId === null) {
        return 0;
    }

    if (selectedId === 'custom') {
        return this.customAmount();
    }
    
    const selectedPkg = this.packages().find(p => p.id === selectedId);
    return selectedPkg ? selectedPkg.coins : 0;
  });

  totalPrice = computed(() => {
    const selectedId = this.selectedPackageId();
    if (selectedId === null) {
      return 0;
    }

    if (selectedId === 'custom') {
        const customCoins = this.customAmount();
        if (customCoins > 0) {
            return customCoins * this.PRICE_PER_COIN;
        }
        return 0;
    }
    
    const selectedPkg = this.packages().find(p => p.id === selectedId);
    return selectedPkg ? selectedPkg.price : 0;
  });

  // Event Handlers
  async searchProfile(): Promise<void> {
    const username = this.recipientUsername().trim();
    if (!username) return;

    this.isSearching.set(true);
    this.searchError.set(null);
    this.searchedProfile.set(null);

    try {
      const response = await fetch('/api/tiktok-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username })
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.setupRequired) {
          this.searchError.set('API Key missing. Please add APIFY_TOKEN to AI Studio Secrets.');
        } else {
          this.searchError.set(errorData.error || 'Failed to fetch profile');
        }
        return;
      }

      const profile = await response.json();
      this.searchedProfile.set(profile);
    } catch (error: any) {
      console.error('Search error:', error);
      this.searchError.set(error.message || 'An unexpected error occurred');
    } finally {
      this.isSearching.set(false);
    }
  }

  selectPackage(pkg: CoinPackage): void {
    this.selectedPackageId.set(pkg.id);
  }

  selectCustom(): void {
    this.selectedPackageId.set('custom');
  }

  handleCustomInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = parseInt(input.value, 10);
    this.customAmount.set(isNaN(value) ? 0 : value);
  }

  handleRecipientUsernameChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.recipientUsername.set(input.value);
  }

  // Opens the confirmation modal
  recharge(): void {
    const recipient = this.recipientUsername();
    if (this.totalPrice() > 0 && recipient) {
      this.showConfirmationModal.set(true);
    }
  }

  // Finalizes the recharge from the modal
  confirmRecharge(): void {
    this.showConfirmationModal.set(false);
    this.showSuccessModal.set(true);
    this.showBankNotification.set(true);
    setTimeout(() => {
      this.showBankNotification.set(false);
    }, 4000);
  }
  
  // Closes the confirmation modal
  cancelRecharge(): void {
    this.showConfirmationModal.set(false);
  }

  // Closes the success modal and resets state for a new transaction
  closeSuccessModal(): void {
    this.showSuccessModal.set(false);
    this.selectedPackageId.set(null);
    this.customAmount.set(0);
    this.recipientUsername.set('');
    this.searchedProfile.set(null);
  }

  // UI Helpers
  formatPrice(price: number): string {
    return price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace('.', ',');
  }
}