import { StyledInfoDialog } from "../IvCalc/Strength/StrengthBerryIngSkillView";
import React from "react";
import { Box, Button, DialogActions, DialogContent, DialogTitle, IconButton, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import MainSkillIcon from "../IvCalc/MainSkillIcon";
import { round2, formatNice, formatWithComma } from '../../util/NumberUtil';
import PokemonStrength, { StrengthResult } from '../../util/PokemonStrength';
import { MainSkillName } from "../../util/MainSkill";
import BerryHelpDialog from "../IvCalc/Strength/BerryHelpDialog";
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { getInitialIvState } from "../IvCalc/IvState";
import IngHelpDialog from "../IvCalc/Strength/IngHelpDialog";
import IngredientIcon from '../IvCalc/IngredientIcon';

interface HelperSkillDialogProps {
    open: boolean;
    onClose: () => void;
    skillName: MainSkillName;
    skillStrength: number;
    result: StrengthResult;
    skillInfo: { value: ({ name: string; strength: PokemonStrength; result: StrengthResult; flag: boolean } | null)[], baseValue: number };
}

const HelperSkillDialog = ({ open, onClose, skillName, skillStrength, result, skillInfo }: HelperSkillDialogProps) => {
    const { t } = useTranslation();

    // --- Hooks ---
    const [berryHelpDialogOpen, setBerryHelpDialogOpen] = React.useState(false);
    const [ingHelpDialogOpen, setIngHelpDialogOpen] = React.useState(false);

    const state = getInitialIvState();
    const defaultStrength = new PokemonStrength(state.pokemonIv, state.parameter);
    const [selectedInfo, setSelectedInfo] = React.useState<{ strength: PokemonStrength; result: StrengthResult; }>({
        strength: defaultStrength,
        result: defaultStrength.calculate(),
    });

    const onBerryHelpClick = React.useCallback((idx: number) => {
        const info = skillInfo.value[idx];
        if (!info) return;
        setSelectedInfo({ strength: info.strength, result: info.result });
        setBerryHelpDialogOpen(true);
    }, [skillInfo]);

    const onIngHelpClick = React.useCallback((idx: number) => {
        const info = skillInfo.value[idx];
        if (!info) return;
        setSelectedInfo({ strength: info.strength, result: info.result });
        setIngHelpDialogOpen(true);
    }, [skillInfo]);

    if (!open) return null;

    const multiplier: number = skillInfo.baseValue || 0;

    return (
        <StyledInfoDialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ px: 1, pt: 1, pb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>{t(skillName)}</Typography>
                    <MainSkillIcon mainSkill={skillName} />
                    <Typography variant="h6" sx={{ ml: 1 }}>{formatNice(skillStrength, t)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <span className="box box1">{formatWithComma(Math.round(skillStrength / result.skillCount))}</span>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>×</Typography>
                    <span className="box box2">{round2(result.skillCount)}</span>
                </Box>
            </DialogTitle>

            <DialogContent sx={{ px: 4, py: 2, ml: 1, mr: 1 }}>
                {/* きのみセクション */}
                <Box sx={{ mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
                        <span className="box box1" style={{ fontSize: '0.75rem' }}>{formatWithComma(Math.round(skillStrength / result.skillCount))}</span>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>スキル1回あたりのきのみエナジー</Typography>
                    </Box>
                    
                    {/* カード自体の左右に mx: 1 で余白を設定 */}
                    <Box sx={{ bgcolor: '#f5f5f5', px: 2, py: 1, borderRadius: '16px'}}>
                        {skillInfo.value.filter(info => info !== null && !info.flag).map((info, idx) => {
                            const berryBase = info!.result?.berryTotalStrength || 0;
                            return (
                                <Box key={idx} sx={{ display: 'flex', alignItems: 'center', mb: 1, '&:last-child': { mb: 0 } }}>
                                    <Typography sx={{ width: 120, fontSize: '0.85rem', color: 'text.secondary' }}>
                                        {info!.name} ：
                                    </Typography>
                                    <Typography sx={{ width: 80, textAlign: 'right', fontWeight: 'bold', mr: 2 }}>
                                        {formatWithComma(Math.round(berryBase * multiplier))}
                                    </Typography>
                                    <Typography sx={{ color: 'text.disabled', fontSize: '0.75rem' }}>
                                        ({formatWithComma(berryBase)} × {round2(multiplier)})
                                    </Typography>
                                    {info!.result && (
                                        <IconButton size="small" onClick={() => onBerryHelpClick(idx)} sx={{ ml: 'auto', p: 0.5 }}>
                                            <InfoOutlinedIcon sx={{ fontSize: 16 }} />
                                        </IconButton>
                                    )}
                                </Box>
                            );
                        })}
                    </Box>
                </Box>

                {/* 食材セクション */}
                <Box sx={{ mb: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1}}>
                        スキル1回あたりの食材数
                    </Typography>
                    <Box sx={{ bgcolor: '#f5f5f5', px: 2, py: 1, borderRadius: '16px'}}>
                        {skillInfo.value.filter(info => info !== null && !info.flag).map((info, idx) => (
                            <Box key={idx} sx={{ display: 'flex', alignItems: 'flex-start', mb: 1.5, '&:last-child': { mb: 0 } }}>
                                <Typography sx={{ width: 120, fontSize: '0.85rem', mt: '6px', color: 'text.secondary' }}>
                                    {info!.name} ：
                                </Typography>
                                <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    {info!.result?.ingredients && Object.entries(info!.result.ingredients).map(([name, ing]) => (
                                        <Box key={name} sx={{ display: 'flex', alignItems: 'center', height: '28px' }}>
                                            <Box sx={{ 
                                                display: 'flex', alignItems: 'center', bgcolor: 'white', 
                                                pl: 0.5, pr: 1.5, height: '28px', borderRadius: '14px', border: '1px solid #eee', mr: 2
                                            }}>
                                                <Box sx={{ width: 20, height: 20, mr: 1, display: 'flex', alignItems: 'center' }}>
                                                    <IngredientIcon name={ing.name} />
                                                </Box>
                                                <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.9rem', lineHeight: 1 }}>
                                                    {(ing.count * multiplier).toFixed(1)}
                                                </Typography>
                                            </Box>
                                            <Typography sx={{ color: 'text.disabled', fontSize: '0.75rem' }}>
                                                ({ing.count.toFixed(1)} × {round2(multiplier)})
                                            </Typography>
                                        </Box>
                                    ))}
                                </Box>
                                {info!.result && (
                                    <IconButton size="small" onClick={() => onIngHelpClick(idx)} sx={{ ml: 'auto', mt: 0.5, p: 0.5 }}>
                                        <InfoOutlinedIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                )}
                            </Box>
                        ))}
                    </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1 }}>
                    <span className="box box2">{round2(result.skillCount)}</span>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{t('skill count')}</Typography>
                </Box>
            </DialogContent>

            <DialogActions sx={{ px: 4, pb: 4 }}>
                <Button onClick={onClose} variant="text" sx={{ fontWeight: 'bold', fontSize: '1rem' }}>
                    {t('close')}
                </Button>
            </DialogActions>

            <BerryHelpDialog open={berryHelpDialogOpen} onClose={() => setBerryHelpDialogOpen(false)} strength={selectedInfo.strength} result={selectedInfo.result} />
            <IngHelpDialog open={ingHelpDialogOpen} onClose={() => setIngHelpDialogOpen(false)} strength={selectedInfo.strength} result={selectedInfo.result} dispatch={() => { }} />
        </StyledInfoDialog>
    );
};

export default HelperSkillDialog;