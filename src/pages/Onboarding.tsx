import React from 'react';
import { useNavigate } from 'react-router-dom';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress';
import { OnboardingWelcome } from '@/components/onboarding/OnboardingWelcome';
import { OnboardingCategories } from '@/components/onboarding/OnboardingCategories';
import { OnboardingRegions } from '@/components/onboarding/OnboardingRegions';
import { OnboardingNotifications } from '@/components/onboarding/OnboardingNotifications';
import { useOnboarding } from '@/hooks/useOnboarding';

const Onboarding = () => {
  const navigate = useNavigate();
  const {
    preferences,
    categories,
    regions,
    notifications,
    loading,
    saving,
    updateStep,
    updateCompanyName,
    toggleCategory,
    toggleRegion,
    selectAllRegions,
    clearAllRegions,
    updateNotifications,
    completeOnboarding,
  } = useOnboarding();

  const currentStep = preferences?.onboarding_step ?? 1;

  const handleNext = async () => {
    if (currentStep < 4) {
      await updateStep(currentStep + 1);
    }
  };

  const handleBack = async () => {
    if (currentStep > 1) {
      await updateStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    const success = await completeOnboarding();
    if (success) {
      navigate('/');
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <OnboardingWelcome
            companyName={preferences?.company_name}
            onCompanyNameChange={updateCompanyName}
            onNext={handleNext}
            saving={saving}
          />
        );
      case 2:
        return (
          <OnboardingCategories
            selectedCategories={categories}
            onToggleCategory={toggleCategory}
            onNext={handleNext}
            onBack={handleBack}
            saving={saving}
          />
        );
      case 3:
        return (
          <OnboardingRegions
            selectedRegions={regions}
            onToggleRegion={toggleRegion}
            onSelectAll={selectAllRegions}
            onClearAll={clearAllRegions}
            onNext={handleNext}
            onBack={handleBack}
            saving={saving}
          />
        );
      case 4:
        return (
          <OnboardingNotifications
            notifications={notifications}
            onUpdateNotifications={updateNotifications}
            onComplete={handleComplete}
            onBack={handleBack}
            saving={saving}
          />
        );
      default:
        return null;
    }
  };

  return (
    <OnboardingLayout loading={loading}>
      <OnboardingProgress currentStep={currentStep} />
      {renderStep()}
    </OnboardingLayout>
  );
};

export default Onboarding;
