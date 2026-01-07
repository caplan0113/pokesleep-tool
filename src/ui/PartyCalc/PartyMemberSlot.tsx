import React from 'react';
import { Box, Paper, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
// import EditDocument from '@mui/icons-material/EditDocument';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import { StrengthResult } from '../../util/PokemonStrength';
import PokemonIv from '../../util/PokemonIv';
import PokemonIcon from '../IvCalc/PokemonIcon';
import IngredientIcon from '../IvCalc/IngredientIcon';
// import { useTranslation } from 'react-i18next'; // インポートは残しておきます
import { formatWithComma } from '../../util/NumberUtil';

interface PartyMemberSlotProps {
  member: { iv: PokemonIv; nickname: string; result: StrengthResult, skillStrength: number, skillIngTotal: Record<string, number> | null } | null;
  onRemove: () => void;
  onEdit: () => void;
}

export default function PartyMemberSlot({ member, onRemove, onEdit }: PartyMemberSlotProps) {
  // エラー回避のため、使用していない場合は取得しないか、削除します
  // const { t } = useTranslation(); 

  if (!member) {
    return (
      <Paper 
        variant="outlined" 
        sx={{ 
          height: 135, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          borderStyle: 'dashed', 
          bgcolor: '#fafafa', 
          color: 'text.disabled' 
        }}
      >
        <Typography variant="caption">枠</Typography>
      </Paper>
    );
  }

  const { iv, nickname, result, skillStrength } = member;

  return (
    <Paper 
      sx={{ 
        p: 0.5, 
        position: 'relative', 
        height: 135, 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center' 
      }}
    >
      <IconButton 
        size="small" 
        onClick={onEdit} 
        sx={{ position: 'absolute', top: 0, left: 0, p: 0.2 }}
      >
        <EditNoteOutlinedIcon sx={{ fontSize: 18 }} />
      </IconButton>
      <IconButton 
        size="small" 
        onClick={onRemove} 
        sx={{ position: 'absolute', top: 0, right: 0, p: 0.2 }}
      >
        <CloseIcon sx={{ fontSize: 18 }} />
      </IconButton>

      <PokemonIcon idForm={iv.idForm} size={36} />
      
      {/* ニックネーム表示 */}
      <Typography 
        variant="caption" 
        sx={{ 
          fontWeight: 'bold', 
          fontSize: '0.7rem', 
          mt: 0.2, 
          whiteSpace: 'nowrap', 
          overflow: 'hidden', 
          textOverflow: 'ellipsis', 
          width: '100%', 
          textAlign: 'center' 
        }}
      >
        {nickname}
      </Typography>

      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem', mt: -0.5 }}>
        Lv.{iv.level}
      </Typography>

      {/* 食材表示（アイコンサイズ固定 16px） */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '2px', mt: 0.5 }}>
        {result.ingredients.map((ing, idx) => (
          <Box key={idx} sx={{ display: 'flex', alignItems: 'center' }}>
            <Box sx={{ 
              width: 16, 
              height: 16, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              '& svg': { width: '100%', height: '100%' } 
            }}>
              <IngredientIcon name={ing.name} />
            </Box>
            <Typography sx={{ fontSize: '0.65rem', fontWeight: 'bold', ml: '1px' }}>
              {ing.count.toFixed(1)}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* 個別エナジー表示 */}
      <Box 
        sx={{ 
          mt: 'auto', 
          width: '100%', 
          bgcolor: 'primary.main', 
          borderRadius: 0.5, 
          textAlign: 'center' 
        }}
      >
        {/* <Typography sx={{ color: '#fff', fontSize: '0.65rem', fontWeight: 'bold' }}>
          {"total: " + formatWithComma(Math.floor(result.totalStrength))}
        </Typography> */}
        <Typography sx={{ color: '#fff', fontSize: '0.65rem', fontWeight: 'bold' }}>
          {"Berry: " + formatWithComma(Math.floor(result.berryTotalStrength))}
          {" / Skill: " + formatWithComma(Math.floor(skillStrength)) + " ("+result.skillCount.toFixed(1)+")"}
        </Typography>
      </Box>
    </Paper>
  );
}